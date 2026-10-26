#!/usr/bin/env node
// Run a Codex review of a pull request's branch against its base and post the findings to the PR as one COMMENT
// review, an inline comment per finding, each starting with "[Codex] <severity>" so a Claude session can tell them
// apart from people's comments and act on them (CLAUDE.md, "Codex reviews open PRs").
//
//   node scripts/codex-pr-review.mjs <pr-number> [--dry-run]
//
// Run it from a checkout of the PR's branch at its pushed head. It needs the Codex plugin for Claude Code
// (openai-codex), the Codex CLI signed in, and gh signed in. Without Codex it says so and exits 0, so contributors
// without it carry on as normal. --dry-run prints the review instead of posting it.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FOCUS =
  "Apply CLAUDE.md: the rules authority order (the Rules Reference and FFG rulings over engine readings), " +
  "the engine/content/client boundaries and the standing client rules.";
const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const pr = args.find((a) => /^\d+$/.test(a));
if (!pr) {
  console.error("Usage: node scripts/codex-pr-review.mjs <pr-number> [--dry-run]");
  process.exit(1);
}

const run = (cmd, cmdArgs, options = {}) => execFileSync(cmd, cmdArgs, { encoding: "utf8", ...options }).trim();

// The plugin's companion script, newest installed version (CODEX_COMPANION overrides).
function findCompanion() {
  if (process.env.CODEX_COMPANION) return existsSync(process.env.CODEX_COMPANION) ? process.env.CODEX_COMPANION : null;
  const root = join(homedir(), ".claude", "plugins", "cache", "openai-codex", "codex");
  if (!existsSync(root)) return null;
  const versions = readdirSync(root)
    .filter((v) => existsSync(join(root, v, "scripts", "codex-companion.mjs")))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return versions.length > 0 ? join(root, versions.at(-1), "scripts", "codex-companion.mjs") : null;
}

const skip = (why) => {
  console.log(`Skipping the Codex review: ${why}`);
  process.exit(0);
};

const companion = findCompanion();
if (!companion) skip("the Codex plugin for Claude Code isn't installed.");
let setup;
try {
  setup = JSON.parse(run(process.execPath, [companion, "setup", "--json"], { stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  skip("the Codex plugin's setup check failed; run /codex:setup.");
}
if (!setup.codex?.available) skip("the Codex CLI isn't installed (run /codex:setup).");
if (!setup.auth?.loggedIn) skip("the Codex CLI isn't signed in (run `codex login`).");

const info = JSON.parse(run("gh", ["pr", "view", pr, "--json", "headRefName,headRefOid,baseRefName,url"]));
const repo = info.url.match(/github\.com\/([^/]+\/[^/]+)\/pull\//)[1];
const head = run("git", ["rev-parse", "HEAD"]);
if (head !== info.headRefOid) {
  console.error(
    `HEAD is ${head.slice(0, 9)}, but PR #${pr} (${info.headRefName}) is at ${info.headRefOid.slice(0, 9)}. ` +
      "Run this from a checkout of the PR's branch at its pushed head.",
  );
  process.exit(1);
}
run("git", ["fetch", "--quiet", "origin", info.baseRefName]);
const base = `origin/${info.baseRefName}`;

// Resolve on 'exit', not 'close': the companion can leave a broker process holding its pipes open after it is done.
function review() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [companion, "adversarial-review", "--wait", "--json", "--base", base, FOCUS],
      {
        stdio: ["ignore", "pipe", "inherit"],
      },
    );
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.on("error", reject);
    child.on("exit", () => setTimeout(() => resolve(out), 200));
  });
}

console.log(`Running a Codex review of ${info.headRefName} against ${base}…`);
const payload = JSON.parse(await review());
if (!payload.result) {
  console.error(`Codex returned no review: ${payload.parseError ?? "no structured output"}`);
  process.exit(1);
}

// Lines GitHub accepts inline comments on: the right side of each hunk of the PR's diff (3 lines of context).
const hunks = new Map();
let file = null;
for (const line of run("git", ["diff", "--unified=3", `${base}...HEAD`], { maxBuffer: 1 << 28 }).split("\n")) {
  if (line.startsWith("+++ ")) file = line === "+++ /dev/null" ? null : line.slice(6);
  const m = file && line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
  if (m) {
    const start = Number(m[1]);
    const end = start + Number(m[2] ?? 1) - 1;
    if (end >= start) hunks.set(file, [...(hunks.get(file) ?? []), [start, end]]);
  }
}
const hunkOf = (path, line) => (hunks.get(path) ?? []).find(([s, e]) => line >= s && line <= e);

const findings = [...payload.result.findings].sort(
  (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
);
const text = (f) =>
  `**[Codex] ${f.severity}** ${f.title}\n\n${f.body}\n\n**Recommendation:** ${f.recommendation}` +
  `\n\n_Confidence: ${f.confidence}_`;

const comments = [];
const outside = [];
for (const f of findings) {
  const path = f.file.replace(/\\/g, "/").replace(/^\.\//, "");
  const hunk = hunkOf(path, f.line_end) ?? hunkOf(path, f.line_start);
  if (!hunk) {
    outside.push(f);
    continue;
  }
  const end = Math.min(Math.max(f.line_end, hunk[0]), hunk[1]);
  const start = Math.max(Math.min(f.line_start, end), hunk[0]);
  comments.push({
    path,
    line: end,
    side: "RIGHT",
    ...(start < end ? { start_line: start, start_side: "RIGHT" } : {}),
    body: text(f),
  });
}

const sha = head.slice(0, 9);
let body =
  findings.length === 0
    ? `[Codex] No findings on ${sha}.`
    : `[Codex] ${findings.length} finding${findings.length === 1 ? "" : "s"} on ${sha}.`;
for (const f of outside) body += `\n\n---\n\n\`${f.file}:${f.line_start}\` (outside the diff)\n\n${text(f)}`;

const reviewRequest = { commit_id: info.headRefOid, event: "COMMENT", body, comments };
if (dryRun) {
  console.log(JSON.stringify(reviewRequest, null, 2));
  process.exit(0);
}
const posted = JSON.parse(
  run("gh", ["api", "--method", "POST", `repos/${repo}/pulls/${pr}/reviews`, "--input", "-"], {
    input: JSON.stringify(reviewRequest),
  }),
);
console.log(
  `Posted a Codex review to PR #${pr}: ${comments.length} inline, ${outside.length} outside the diff. ${posted.html_url}`,
);
