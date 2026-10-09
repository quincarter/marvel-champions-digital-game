// Which unit tests a set of changed files can affect. Shared by CI (scripts/ci-test-plan.mjs) and the local
// `pnpm test:affected` (scripts/test-affected.mjs), so both skip by the same rule.
//
// The rule follows the import direction, which only points one way (checked 2026-10-09):
//   - packages: client → cards → engine → content. A change to a package can break it and the packages above it.
//   - waves of the cards package: a wave's scripts import only from earlier waves. A change inside wave folders can
//     break those waves and later ones, so the earlier waves are skipped. Anything else in the cards package (core,
//     campaigns, the DSL, the test harness) runs every wave.
//   - a changelog fragment affects nothing; any other file outside `packages/` (the lockfile, a config, docs or art
//     a test may read) runs everything.
import { readdirSync } from "node:fs";

export const WAVES_DIR = "packages/cards/src";

// Lowest in the dependency chain first: a change to one affects it and everything after it.
const PROJECTS = ["content", "engine", "cards", "client"];
const PACKAGE_FILE = /^packages\/(content|engine|cards|client)\//;
const WAVE_FILE = /^packages\/cards\/src\/wave(\d+)\//;
const NEVER_AFFECTS_TESTS = /^\.changes\//;

/** The wave numbers that have a folder in the cards package, ascending. */
export function wavesOnDisk() {
  return readdirSync(WAVES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^wave\d+$/.test(entry.name))
    .map((entry) => Number(entry.name.slice(4)))
    .sort((a, b) => a - b);
}

/**
 * `projects`: the packages whose tests to run, in dependency order (empty when nothing changed that a test could
 * see). `firstWave`: the earliest cards wave to run, or 0 for every wave.
 */
export function affectedBy(changedPaths) {
  let lowest = PROJECTS.length;
  let firstWave = Infinity;
  for (const path of changedPaths) {
    if (NEVER_AFFECTS_TESTS.test(path)) continue;
    const pkg = PACKAGE_FILE.exec(path);
    if (!pkg) return everything();
    lowest = Math.min(lowest, PROJECTS.indexOf(pkg[1]));
    if (pkg[1] === "cards") {
      const wave = WAVE_FILE.exec(path);
      firstWave = Math.min(firstWave, wave ? Number(wave[1]) : 0);
    }
  }
  // A change below the cards package reaches every wave.
  if (lowest < PROJECTS.indexOf("cards") || firstWave === Infinity) firstWave = 0;
  return { projects: PROJECTS.slice(lowest), firstWave };
}

export function everything() {
  return { projects: [...PROJECTS], firstWave: 0 };
}
