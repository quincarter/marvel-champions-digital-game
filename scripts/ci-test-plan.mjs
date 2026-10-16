// Plans the unit-test jobs of .github/workflows/netlify-deploy.yml: prints the job matrix as JSON.
//
// One job per wave folder of the cards package (found on disk, so a new wave needs no workflow edit), three for the
// cards tests outside the wave folders, and up to two for the other packages. The "cards (shared)" group is defined by
// exclusion, so a test file outside the wave folders can never fall between the groups. Jobs the changed files can't affect are left out
// (scripts/lib/test-plan.mjs has the rule); with no list of changed files, as on a push to main, every job runs.
//
//   node scripts/ci-test-plan.mjs [file listing the changed paths, one per line]
import { readFileSync } from "node:fs";
import { affectedBy, everything, WAVES_DIR, wavesOnDisk } from "./lib/test-plan.mjs";

const changedFile = process.argv[2];
const changedPaths = changedFile ? readFileSync(changedFile, "utf8").split("\n").filter(Boolean) : [];
let plan = affectedBy(changedPaths);
if (plan.projects.length === 0) plan = everything();

const has = (project) => plan.projects.includes(project);
const lower = ["engine", "content"].filter(has);
const LOWER_TITLE = { engine: "core engine", content: "card data" };
// The slowest files of the cards package, each a few hundred seeded games, run in jobs of their own. Vitest's
// `--shard` splits by file count, not time, so these landed wherever their path hashed: one shard took 21 to 31
// minutes while another took three (2026-10-16). Paths are from the repository root; a listed file that is renamed
// fails its job ("No test files found") rather than falling out of the run.
const SOAKS = {
  // One soak in four files (./testing/modular-soak.ts), about six minutes each, side by side in one job.
  modular: ["packages/cards/src/modular-matrix-soak-"],
  // Seven to thirteen minutes each.
  decks: [
    "packages/cards/src/playable/marvelcdb-decklists.test.ts",
    "packages/cards/src/playable/random-decks.test.ts",
    "packages/cards/src/modular-matrix.test.ts",
  ],
};
const soakExcludes = Object.values(SOAKS)
  .flat()
  .map((path) => `--exclude "**/${path.replace(/^packages\/cards\//, "")}${path.endsWith(".test.ts") ? "" : "*"}"`)
  .join(" ");
const capitalized = (text) => text[0].toUpperCase() + text.slice(1);

// `name` is the job's name in the checks list; `title` heads its test report on the run's summary page.

const include = [
  ...(lower.length > 0
    ? [
        {
          name: lower.join(" and "),
          title: capitalized(`${lower.map((project) => LOWER_TITLE[project]).join(" and ")} tests`),
          args: lower.map((project) => `--project @mc/${project}`).join(" "),
        },
      ]
    : []),
  ...(has("client") ? [{ name: "client", title: "Game client tests", args: "--project @mc/client" }] : []),
  ...(has("cards")
    ? [
        {
          name: "cards (shared)",
          title: "Shared card tests (core set, campaigns, ability DSL)",
          args: `--project @mc/cards --exclude "**/src/wave*/**" ${soakExcludes}`,
        },
        {
          name: "cards (modular soak)",
          title: "Modular set soak",
          args: `--project @mc/cards ${SOAKS.modular.join(" ")}`,
        },
        {
          name: "cards (deck soaks)",
          title: "Deck and modular matrix soaks",
          args: `--project @mc/cards ${SOAKS.decks.join(" ")}`,
        },
        ...wavesOnDisk()
          .filter((wave) => wave >= plan.firstWave)
          // The trailing slash keeps wave1 from also matching wave10.
          .map((wave) => ({
            name: `cards wave ${wave}`,
            title: `Wave ${wave} card tests`,
            args: `--project @mc/cards ${WAVES_DIR}/wave${wave}/`,
          })),
      ]
    : []),
];

console.log(JSON.stringify({ include }));
