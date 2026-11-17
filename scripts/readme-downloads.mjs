#!/usr/bin/env node
// Points the README's version badge and download buttons at a published release (#789).
//
//   node scripts/readme-downloads.mjs <release.json> [<open-pr-readme.md>]
//
// <release.json> is `gh release view <tag> --json tagName,isDraft,isPrerelease,assets`. Refuses (exit 1) while the
// release is a draft or a prerelease, or is missing a file the buttons would link to. Changes nothing when the README
// already shows that version or a newer one, or <open-pr-readme.md> (the README on the open pull request's branch)
// does, so publishing an older release by hand never moves the buttons back.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUTTON_SVGS,
  bumpButton,
  bumpReadme,
  compareVersions,
  normalizeTag,
  readmeVersion,
  releaseProblems,
} from "./lib/readme-downloads.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseFile = process.argv[2];
if (!releaseFile) {
  console.error("Usage: node scripts/readme-downloads.mjs <release.json>");
  process.exit(2);
}

const release = JSON.parse(fs.readFileSync(releaseFile, "utf8"));
const tag = normalizeTag(release.tagName);
const readmePath = path.join(root, "README.md");
const readme = fs.readFileSync(readmePath, "utf8");

const current = readmeVersion(readme);
const openFile = process.argv[3];
const pending = openFile ? readmeVersion(fs.readFileSync(openFile, "utf8")) : null;
for (const [where, version] of [
  ["The README", current],
  ["The open README pull request", pending],
]) {
  if (version && compareVersions(version, tag) >= 0) {
    console.log(`${where} already shows ${version}; leaving it for ${tag}.`);
    process.exit(0);
  }
}

const bumped = bumpReadme(readme, tag);
const problems = releaseProblems(release, bumped);
if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(1);
}

fs.writeFileSync(readmePath, bumped);
for (const svg of BUTTON_SVGS) {
  const file = path.join(root, svg);
  fs.writeFileSync(file, bumpButton(fs.readFileSync(file, "utf8"), tag));
}
console.log(`The README's downloads now point at ${tag}${current ? ` (were ${current})` : ""}.`);
