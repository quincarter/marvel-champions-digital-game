// Plans the unit-test jobs of .github/workflows/netlify-deploy.yml: prints the job matrix as JSON.
//
// One job per wave folder of the cards package (found on disk, so a new wave needs no workflow edit), and up to
// three for everything else. The "cards (shared)" group is defined by exclusion, so a test file outside the wave
// folders can never fall between the groups. Jobs the changed files can't affect are left out
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
          args: `--project @mc/cards --exclude "**/src/wave*/**"`,
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
