// node --test scripts/ (pnpm test:scripts). No workflow job both runs pack code and holds a secret (§11.9).
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { checkWorkflow, checkWorkflows, splitJobs } from "./check-workflow-secrets.mjs";

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
