// Plans the unit-test jobs of .github/workflows/netlify-deploy.yml: prints the job matrix as JSON.
//
// One job per wave folder of the cards package (found on disk, so a new wave needs no workflow edit), one for the
// cards tests outside the wave folders and one for each of their slowest files, and up to two for the other packages.
// The "cards (shared)" group is defined by exclusion, so a test file outside the wave folders can never fall between
// the groups. Jobs the changed files can't affect are left out
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
// minutes while another took three (2026-10-16). A runner runs only two or three such files at once, and they slow
// each other down (a 13-minute file took 17 beside two others), so each gets a job, or shares one with a single
// other. Paths are from the repository root; a listed file that is renamed fails its job ("No test files found")
// rather than falling out of the run.
const SOAKS = [
  // One soak dealt over four files (./testing/modular-soak.ts), about seven minutes each.
  {
    name: "modular soak 1-2",
    title: "Modular set soak, parts 1 and 2",
    paths: ["packages/cards/src/modular-matrix-soak-1.test.ts", "packages/cards/src/modular-matrix-soak-2.test.ts"],
  },
  {
    name: "modular soak 3-4",
    title: "Modular set soak, parts 3 and 4",
    paths: ["packages/cards/src/modular-matrix-soak-3.test.ts", "packages/cards/src/modular-matrix-soak-4.test.ts"],
  },
  // The MarvelCDB decklist games, dealt over four files the same way (./playable/marvelcdb-decklists.ts).
  {
    name: "MarvelCDB decklists 1-2",
    title: "MarvelCDB decklists, parts 1 and 2",
    paths: [
      "packages/cards/src/playable/marvelcdb-decklists-1.test.ts",
      "packages/cards/src/playable/marvelcdb-decklists-2.test.ts",
    ],
  },
  {
    name: "MarvelCDB decklists 3-4",
    title: "MarvelCDB decklists, parts 3 and 4",
    paths: [
      "packages/cards/src/playable/marvelcdb-decklists-3.test.ts",
      "packages/cards/src/playable/marvelcdb-decklists-4.test.ts",
    ],
  },
  { name: "random decks", title: "Random deck soak", paths: ["packages/cards/src/playable/random-decks.test.ts"] },
  { name: "modular matrix", title: "Modular matrix pairings", paths: ["packages/cards/src/modular-matrix.test.ts"] },
];
const soakExcludes = SOAKS.flatMap((soak) => soak.paths)
  .map((path) => `--exclude "**/${path.replace(/^packages\/cards\//, "")}"`)
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
        ...SOAKS.map((soak) => ({
          name: `cards (${soak.name})`,
          title: soak.title,
          args: `--project @mc/cards ${soak.paths.join(" ")}`,
        })),
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
