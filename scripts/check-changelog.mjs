#!/usr/bin/env node
// Lint the unreleased changie fragments (.changes/unreleased/*.yaml) the way the release job reads them, so a bad
// one fails `pnpm check`, the pre-commit hook and CI instead of the release PR job after it reaches main.
//
// changie itself parses every fragment and rejects a kind missing from .changie.yaml (a dry-run batch writes
// nothing). It accepts an empty body, so that is checked here. changie comes from the mise toolchain (mise.toml).
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(".changes", "unreleased");
const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
const problems = [];

for (const file of files) {
  const text = readFileSync(join(dir, file), "utf8");
  const body = text.match(/^body:[ \t]*(.*)$/m);
  if (!body || /^(''|"")?\s*$/.test(body[1])) problems.push(`${file}: the body is empty`);
}

// Through the shell, so Windows finds the mise shim (changie.cmd).
const changie = spawnSync("changie batch patch --dry-run --allow-no-changes", { encoding: "utf8", shell: true });
if (changie.error || changie.status !== 0) {
  const out = `${changie.stderr ?? ""}${changie.error?.message ?? ""}`.trim();
  problems.push(
    changie.status === 127 || /not (found|recognized)|No version is set/i.test(out)
      ? "changie isn't installed: run `mise install` (mise.toml) or see https://changie.dev/guide/installation/"
      : out.split("\n")[0],
  );
}

if (problems.length > 0) {
  console.error(`Changelog fragments (${dir}):`);
  for (const p of problems) console.error(`  ${p}`);
  console.error("A single-quoted body escapes an apostrophe by doubling it: 'Kurt''s Cutlasses'.");
  process.exit(1);
}
console.log(`Changelog fragments: ${files.length} OK.`);
