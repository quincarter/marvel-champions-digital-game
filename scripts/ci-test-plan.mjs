// Plans the unit-test jobs of .github/workflows/netlify-deploy.yml: prints the job matrix as JSON.
//
// One job per wave folder of the cards package (found on disk, so a new wave needs no workflow edit), and three for
// everything else. The "cards (shared)" group is defined by exclusion, so a test file outside the wave folders can
// never fall between the groups.
//
// Skipping: a wave's scripts import only from earlier waves (checked 2026-10-09), so a pull request whose changes all
// sit in wave folders can only break those waves and later ones. It runs them and skips the earlier waves. Changes
// anywhere else (the engine, the DSL, card data, this workflow) run every job, and so does every push to main.
//
//   node scripts/ci-test-plan.mjs [file listing the changed paths, one per line]
import { readdirSync, readFileSync } from "node:fs";

const WAVES_DIR = "packages/cards/src";
const WAVE_FILE = /^packages\/cards\/src\/wave(\d+)\//;
const NEVER_AFFECTS_TESTS = /^\.changes\//;

const waves = readdirSync(WAVES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^wave\d+$/.test(entry.name))
  .map((entry) => Number(entry.name.slice(4)))
  .sort((a, b) => a - b);

/** The earliest wave to run, or 0 to run them all. */
function firstWaveToRun(changedPaths) {
  const touched = [];
  for (const path of changedPaths) {
    const wave = WAVE_FILE.exec(path);
    if (wave) touched.push(Number(wave[1]));
    else if (!NEVER_AFFECTS_TESTS.test(path)) return 0;
  }
  return touched.length > 0 ? Math.min(...touched) : 0;
}

const changedFile = process.argv[2];
const changedPaths = changedFile ? readFileSync(changedFile, "utf8").split("\n").filter(Boolean) : [];
const first = firstWaveToRun(changedPaths);

const include = [
  { name: "engine and content", args: "--project @mc/engine --project @mc/content" },
  { name: "client", args: "--project @mc/client" },
  { name: "cards (shared)", args: `--project @mc/cards --exclude "**/src/wave*/**"` },
  ...waves
    .filter((wave) => wave >= first)
    // The trailing slash keeps wave1 from also matching wave10.
    .map((wave) => ({ name: `cards wave ${wave}`, args: `--project @mc/cards ${WAVES_DIR}/wave${wave}/` })),
];

console.log(JSON.stringify({ include }));
