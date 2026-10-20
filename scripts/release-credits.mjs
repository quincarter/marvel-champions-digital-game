#!/usr/bin/env node
// Credits for the people who report bugs and write code (#268), read from GitHub through the `gh` CLI.
//
//   node scripts/release-credits.mjs notes <from-ref> [to-ref] [version]
//     Prints a release's "Special thanks" section: everyone who reported an issue fixed between the two refs, or
//     authored a pull request merged between them. A PR counts when a commit subject names it, "(#123)"; an issue
//     counts when a commit subject, a merged PR's closing issues ("Fixes #123", or linked in its sidebar) or the
//     release's changelog (`.changes/<version>.md`, the version defaulting to <to-ref>) names it. Prints nothing
//     when there is no one to thank. The release job appends it to the release notes and the release PR body.
//
//   node scripts/release-credits.mjs readme
//     Rewrites the README's two "Special thanks" lists (between the `credits:` markers). The Watchers are people
//     with at least `watcherMinimum` (default 2) issues closed as done: a bug fixed or a feature built, by anyone. A
//     single report, or reports closed as not planned or as duplicates, don't count. The Committers are everyone with
//     a merged pull request, after the `pinnedContributors` (the repository owner by default), who lead the list.
//     The release PR job runs it, so the README stays current release by release.
//
// The repository owner and bots are otherwise left out. `.github/credits.json` adds people GitHub can't see (a bug sent on
// Discord or through the in-game reporter) and names logins to leave out.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CONFIG_FILE = ".github/credits.json";
const README = "README.md";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function ghJson(path) {
  return JSON.parse(gh(["api", path]));
}

// Every page of a list endpoint, flattened.
function ghPaged(path) {
  return JSON.parse(gh(["api", "--paginate", "--slurp", path])).flat();
}

// The issues a PR closes, including ones linked in its Development sidebar or listed after one "Fixes".
function closingIssues(pr) {
  const [repoOwner, name] = repo.split("/");
  const query = `{ repository(owner: "${repoOwner}", name: "${name}") { pullRequest(number: ${pr}) {
    closingIssuesReferences(first: 50) { nodes { number } } } } }`;
  const data = JSON.parse(gh(["api", "graphql", "-f", `query=${query}`]));
  return data.data.repository.pullRequest.closingIssuesReferences.nodes.map((node) => node.number);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

const repo =
  process.env.GITHUB_REPOSITORY || gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
const owner = repo.split("/")[0];

const config = existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, "utf8")) : {};
const excluded = new Set([owner, ...(config.exclude ?? [])].map((login) => login.toLowerCase()));

function counts(user) {
  if (!user?.login || user.type === "Bot" || user.login.endsWith("[bot]")) return false;
  return !excluded.has(user.login.toLowerCase());
}

const ISSUE_REF = /#(\d+)\b/g;
const CLOSES_REF = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi;

function refsIn(text, pattern = ISSUE_REF) {
  return [...(text ?? "").matchAll(pattern)].map((m) => Number(m[1]));
}

// "#1", "#1 and #2", "#1, #2 and #3".
function joinRefs(numbers) {
  const refs = [...new Set(numbers)].sort((a, b) => a - b).map((n) => `#${n}`);
  return refs.length < 2 ? refs.join("") : `${refs.slice(0, -1).join(", ")} and ${refs.at(-1)}`;
}

const byName = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });

function notes(from, to = "HEAD", version = to) {
  const items = new Map();
  const item = (n) => {
    if (!items.has(n)) items.set(n, ghJson(`repos/${repo}/issues/${n}`));
    return items.get(n);
  };

  const subjects = git(["log", "--format=%s", `${from}..${to}`]);
  const changelogFile = `.changes/${version}.md`;
  const issues = new Set(existsSync(changelogFile) ? refsIn(readFileSync(changelogFile, "utf8")) : []);
  const prs = new Set();
  for (const n of new Set(refsIn(subjects))) {
    const found = item(n);
    if (!found.pull_request) issues.add(n);
    else if (found.pull_request.merged_at) {
      prs.add(n);
      for (const closed of [...refsIn(found.body, CLOSES_REF), ...closingIssues(n)]) issues.add(closed);
    }
  }

  const credits = new Map();
  const credit = (login, verb, n) => {
    const key = `${login} ${verb}`;
    credits.set(key, { login, verb, refs: [...(credits.get(key)?.refs ?? []), n] });
  };
  for (const n of prs) if (counts(item(n).user)) credit(item(n).user.login, "wrote", n);
  for (const n of issues) {
    if (prs.has(n)) continue;
    const issue = item(n);
    if (!issue.pull_request && counts(issue.user)) credit(issue.user.login, "reported", n);
  }

  const lines = [...credits.values()].map(({ login, verb, refs }) => `* @${login} ${verb} ${joinRefs(refs)}.`);
  for (const extra of config.release?.[version] ?? []) lines.push(`* ${extra}`);
  if (lines.length === 0) return "";
  return ["### Special thanks", ...lines.sort(byName), ""].join("\n");
}

// Logins that opened at least `minimum` of the items, ranked by how many, then by name.
function ranked(list, minimum = 1) {
  const tally = new Map();
  for (const entry of list) if (counts(entry.user)) tally.set(entry.user.login, (tally.get(entry.user.login) ?? 0) + 1);
  return [...tally.entries()]
    .filter(([, n]) => n >= minimum)
    .sort(([a, x], [b, y]) => y - x || byName(a, b))
    .map(([login]) => login);
}

const AVATARS_PER_ROW = 6;

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Only the avatar is a link: GitHub draws a link's underline through the name's text, which reads as stray marks.
function cell(person) {
  const name = escapeHtml(person.name);
  const link = person.github ? `https://github.com/${person.github}` : person.url;
  const image = person.github
    ? `<img src="https://github.com/${person.github}.png?size=128" width="64" height="64" alt="${name}">`
    : "";
  const avatar = image && link ? `<a href="${link}">${image}</a><br>` : image ? `${image}<br>` : "";
  const label = !image && link ? `<a href="${link}">${name}</a>` : name;
  const note = person.note ? `<br>${escapeHtml(person.note)}` : "";
  return `<td align="center">${avatar}${label}${note}</td>`;
}

function grid(people) {
  if (people.length === 0) return "<p><i>Your name could be here.</i></p>";
  const rows = [];
  for (let i = 0; i < people.length; i += AVATARS_PER_ROW) {
    rows.push(
      `<tr>${people
        .slice(i, i + AVATARS_PER_ROW)
        .map(cell)
        .join("")}</tr>`,
    );
  }
  return `<table>\n${rows.join("\n")}\n</table>`;
}

function person(login) {
  const user = ghJson(`users/${login}`);
  return { github: login, name: user.name || login };
}

// GitHub's people, then the hand-listed ones GitHub doesn't already show.
function people(listed, manual = []) {
  const logins = [...new Map(listed.map((l) => [l.toLowerCase(), l])).values()];
  const list = logins.map(person);
  const seen = new Set(logins.map((l) => l.toLowerCase()));
  for (const entry of manual) {
    if (entry.github && seen.has(entry.github.toLowerCase())) continue;
    list.push(entry.github ? { ...person(entry.github), ...entry } : entry);
  }
  return list;
}

function readme() {
  const all = ghPaged(`repos/${repo}/issues?state=all&per_page=100`);
  // A token without `issues: read` gets an empty list rather than an error, which would blank both lists (v0.28.0).
  if (!all.some((i) => !i.pull_request) || !all.some((i) => i.pull_request)) {
    throw new Error("GitHub listed no issues or no pull requests; the token may lack issues: read. README left as is.");
  }
  const sections = {
    reporters: people(
      ranked(
        all.filter((i) => !i.pull_request && i.state_reason === "completed"),
        config.watcherMinimum ?? 2,
      ),
      config.reporters,
    ),
    contributors: people(
      [...(config.pinnedContributors ?? [owner]), ...ranked(all.filter((i) => i.pull_request?.merged_at))],
      config.contributors,
    ),
  };

  let text = readFileSync(README, "utf8");
  for (const [key, list] of Object.entries(sections)) {
    const block = new RegExp(`(<!-- credits:${key}:start -->)[\\s\\S]*?(<!-- credits:${key}:end -->)`);
    if (!block.test(text)) throw new Error(`${README} has no credits:${key} markers`);
    text = text.replace(block, (_, start, end) => `${start}\n${grid(list)}\n${end}`);
  }
  writeFileSync(README, text);
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "notes" && args[0]) process.stdout.write(notes(...args));
else if (mode === "readme") readme();
else {
  console.error("usage: release-credits.mjs notes <from-ref> [to-ref] [version] | readme");
  process.exit(1);
}
