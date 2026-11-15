// node --test scripts/ (pnpm test:scripts). pnpm packs:fetch with --from: a local registry checkout is copied every time.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const script = path.join(import.meta.dirname, "packs-fetch.mjs");

describe("packs-fetch.mjs --from", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mc-packs-fetch-"));
  after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const registry = path.join(temp, "registry");
  const dest = path.join(temp, "community");
  const write = (version) => {
    fs.mkdirSync(path.join(registry, "packs", "fan-a"), { recursive: true });
    fs.writeFileSync(path.join(registry, "packs", "fan-a", "pack.json"), JSON.stringify({ id: "fan-a", version }));
  };
  const run = () =>
    spawnSync(process.execPath, [script, "--from", registry], {
      encoding: "utf8",
      env: { ...process.env, MC_PACKS_DEST: dest },
    });
  const copied = () => JSON.parse(fs.readFileSync(path.join(dest, "fan-a", "pack.json"), "utf8")).version;

  it("copies the checkout's current packs on every run, not only the first", () => {
    write("1.0.0");
    assert.equal(run().status, 0);
    assert.equal(copied(), "1.0.0");
    write("1.0.1");
    assert.equal(run().status, 0);
    assert.equal(copied(), "1.0.1");
  });
});
