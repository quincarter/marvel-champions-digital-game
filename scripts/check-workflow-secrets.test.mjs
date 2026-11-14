// node --test scripts/ (pnpm test:scripts). No workflow job both runs pack code and holds a secret (§11.9).
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { checkWorkflow, checkWorkflows, splitJobs, splitSteps } from "./check-workflow-secrets.mjs";

const workflows = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".github", "workflows");

describe("this repo's workflows", () => {
  const results = checkWorkflows(workflows);
  const byFile = Object.fromEntries(results.map((r) => [r.file, r]));

  it("run pack code only in jobs without secrets, write permissions or a kept token", () => {
    assert.deepEqual(
      results.flatMap((r) => r.problems.map((p) => `${r.file}: ${p}`)),
      [],
    );
  });

  it("build the packs and the SDK in their own jobs, apart from the uploads", () => {
    assert.deepEqual(byFile["publish-packs.yml"].packCodeJobs, ["build"]);
    assert.deepEqual(byFile["mod-sdk.yml"].packCodeJobs, ["build"]);
  });
});

describe("checkWorkflow", () => {
  const workflow = (jobs) => `name: x\non: push\njobs:\n${jobs}`;

  it("flags a job that runs mc-pack with a secret, a write permission and a kept token", () => {
    const text = workflow(
      [
        "  publish:",
        "    runs-on: ubuntu-latest",
        "    environment: store",
        "    permissions:",
        "      contents: write",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - run: pnpm --filter @mc/mod-sdk mc-pack build pack --out out",
        "        env:",
        "          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), [
      "publish: runs pack code and references secrets",
      "publish: runs pack code in a deployment environment",
      "publish: runs pack code with a write permission",
      "publish: runs pack code after a checkout that keeps its token",
    ]);
  });

  it("flags a secret job that installs dependencies beside a pack-code job", () => {
    const text = workflow(
      [
        "  build:",
        "    permissions:",
        "      contents: read",
        "    steps:",
        "      - run: bash scripts/build-entry.sh packs/x.yaml out",
        "  upload:",
        "    steps:",
        "      - run: npm ci",
        "        env:",
        "          TOKEN: ${{ secrets.NPM_TOKEN }}",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), [
      "upload: holds secrets and installs dependencies in a workflow that runs pack code",
    ]);
  });

  it("ignores comments and workflows that run no pack code", () => {
    const text = workflow(
      [
        "  deploy:",
        "    # mc-pack is not run here",
        "    steps:",
        "      - run: pnpm install",
        "        env:",
        "          TOKEN: ${{ secrets.NETLIFY }}",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), []);
    assert.deepEqual(
      splitJobs(text).map((j) => j.name),
      ["deploy"],
    );
  });
});

/** A one-job workflow whose steps are `steps` (YAML lines, already indented under `steps:`). */
const oneJob = (steps, { jobEnv = [] } = {}) =>
  [
    "on: push",
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    permissions:",
    "      contents: read",
    ...jobEnv,
    "    steps:",
    "      - uses: actions/checkout@v4",
    "        with:",
    "          persist-credentials: false",
    ...steps,
    "",
  ].join("\n");

const token = "${{ github.token }}";
const fetchStep = [
  "      - name: Fetch releases",
  "        env:",
  `          GH_TOKEN: ${token}`,
  "        run: bash scripts/fetch-release.sh packs/x.yaml work",
];
const buildStep = ["      - name: Build", "        run: bash scripts/build-entry.sh packs/x.yaml work"];

describe("GitHub tokens in jobs that run pack code", () => {
  it("allows a token in a step that only fetches, before the build", () => {
    assert.deepEqual(checkWorkflow(oneJob([...fetchStep, ...buildStep])), []);
  });

  it("refuses a token in the step that runs pack code", () => {
    const steps = [buildStep[0], "        env:", `          GH_TOKEN: ${token}`, buildStep[1]];
    assert.deepEqual(checkWorkflow(oneJob(steps)), ['build: step "Build" runs pack code with a GitHub token']);
  });

  it("refuses a token in a step that installs dependencies", () => {
    const install = ["      - name: Install", "        env:", "          GITHUB_TOKEN: x", "        run: npm ci"];
    assert.deepEqual(checkWorkflow(oneJob([...install, ...buildStep])), [
      'build: step "Install" runs pack code with a GitHub token',
    ]);
  });

  it("refuses a token in a step after pack code ran", () => {
    assert.deepEqual(checkWorkflow(oneJob([...buildStep, ...fetchStep])), [
      'build: step "Fetch releases" uses a GitHub token after pack code ran',
    ]);
  });

  it("refuses a token in the job's env", () => {
    const jobEnv = ["    env:", `      GH_TOKEN: ${token}`];
    assert.deepEqual(checkWorkflow(oneJob(buildStep, { jobEnv })), [
      "build: runs pack code with a GitHub token in the job's env",
    ]);
  });

  it("refuses a checkout that keeps its token in any job of a workflow that runs pack code", () => {
    const list = [
      "  list:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - run: bash scripts/changed-entries.sh main",
      "",
    ];
    assert.deepEqual(checkWorkflow(oneJob(buildStep) + list.join("\n")), [
      "list: has a checkout that keeps its token in a workflow that runs pack code",
    ]);
  });

  it("splits steps by their item indentation, not by nested list items", () => {
    const { steps } = splitSteps(
      [
        "    runs-on: x",
        "    steps:",
        "      - uses: a",
        "        with:",
        "          list:",
        "            - nested",
        "      - name: Second",
        "        run: echo",
      ].join("\n"),
    );
    assert.deepEqual(
      steps.map((s) => s.name),
      ["uses: a", "Second"],
    );
  });
});
