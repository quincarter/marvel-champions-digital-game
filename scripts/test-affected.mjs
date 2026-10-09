// `pnpm test:affected [base]`: run only the unit tests your changes can affect, by the same rule CI uses
// (scripts/lib/test-plan.mjs). "Your changes" are everything that differs from `base`, committed or not, plus
// untracked files. `base` defaults to the branch's upstream, so it is what you have not pushed yet; pass a ref
// (`pnpm test:affected origin/main`) to compare against something else. Extra Vitest flags go after `--`.
import { execFileSync, spawnSync } from "node:child_process";
import { affectedBy, everything, WAVES_DIR, wavesOnDisk } from "./lib/test-plan.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const tryGit = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
};

const args = process.argv.slice(2);
const split = args.indexOf("--");
const [baseArg] = split === -1 ? args : args.slice(0, split);
const vitestArgs = split === -1 ? [] : args.slice(split + 1);

const base = baseArg ?? tryGit("rev-parse", "--abbrev-ref", "@{upstream}") ?? "origin/main";
const mergeBase = tryGit("merge-base", "HEAD", base);

let plan;
if (mergeBase === undefined) {
  console.log(`Can't compare with ${base}; running every test.`);
  plan = everything();
} else {
  const changed = [
    ...git("diff", "--name-only", mergeBase).split("\n"),
    ...git("ls-files", "--others", "--exclude-standard").split("\n"),
  ].filter(Boolean);
  plan = affectedBy(changed);
  if (plan.projects.length === 0) {
    console.log(`Nothing that a unit test could see has changed since ${base}.`);
    process.exit(0);
  }
}

const skippedWaves = plan.projects.includes("cards") ? wavesOnDisk().filter((wave) => wave < plan.firstWave) : [];
console.log(
  `Changes since ${base} affect: ${plan.projects.join(", ")}` +
    (skippedWaves.length > 0 ? ` (skipping cards waves ${skippedWaves.join(", ")})` : ""),
);

const result = spawnSync(
  "pnpm",
  [
    "exec",
    "vitest",
    "run",
    ...plan.projects.flatMap((project) => ["--project", `@mc/${project}`]),
    ...skippedWaves.flatMap((wave) => ["--exclude", `**/${WAVES_DIR}/wave${wave}/**`]),
    ...vitestArgs,
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
