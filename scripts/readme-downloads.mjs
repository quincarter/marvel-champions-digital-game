#!/usr/bin/env node
// Points the README's version badge and download buttons at a published release (#789).
//
//   node scripts/readme-downloads.mjs <release.json> --latest <tag> [--open-readme <file>]
//
// <release.json> is `gh release view <tag> --json tagName,isDraft,isPrerelease,assets`, `--latest` is GitHub's latest
// release's tag, and `--open-readme` is the README on the open README pull request's branch, when there is one.
// Changes nothing (exit 0) when the release isn't GitHub's latest, or main or the open pull request already shows that
// version or a newer one, so a hand-published or retried older release never moves the buttons back (skipReason).
// Refuses (exit 1) a draft, a prerelease, or a release missing a file the buttons would link to.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  BUTTON_SVGS,
  bumpButton,
  bumpReadme,
  normalizeTag,
  publicationProblems,
  readmeVersion,
  releaseProblems,
  skipReason,
} from "./lib/readme-downloads.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { latest: { type: "string" }, "open-readme": { type: "string" } },
});
const [releaseFile] = positionals;
if (!releaseFile || values.latest === undefined) {
  console.error("Usage: node scripts/readme-downloads.mjs <release.json> --latest <tag> [--open-readme <file>]");
  process.exit(2);
}

const release = JSON.parse(fs.readFileSync(releaseFile, "utf8"));
const tag = normalizeTag(release.tagName);
const readmePath = path.join(root, "README.md");
const readme = fs.readFileSync(readmePath, "utf8");
const current = readmeVersion(readme);
const openReadme = values["open-readme"];
const pending = openReadme ? readmeVersion(fs.readFileSync(openReadme, "utf8")) : null;

// A draft or a prerelease fails the run before anything else: it is never GitHub's latest, so the skip below would
// otherwise pass it quietly.
fail(publicationProblems(release));

const skip = skipReason({ tag, latest: values.latest, current, pending });
if (skip) {
  console.log(`::notice::Leaving the README for ${tag}: ${skip}`);
  process.exit(0);
}

const bumped = bumpReadme(readme, tag);
fail(releaseProblems(release, bumped));

fs.writeFileSync(readmePath, bumped);
for (const svg of BUTTON_SVGS) {
  const file = path.join(root, svg);
  fs.writeFileSync(file, bumpButton(fs.readFileSync(file, "utf8"), tag));
}
function fail(problems) {
  if (problems.length === 0) return;
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(1);
}

console.log(`The README's downloads now point at ${tag}${current ? ` (were ${current})` : ""}.`);
