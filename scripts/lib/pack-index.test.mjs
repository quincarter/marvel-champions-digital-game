// node --test scripts/lib/ (pnpm test:scripts). The Mod Store catalog upsert of the publish-packs workflow.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  PACK_INDEX_SCHEMA,
  compareVersions,
  packIndexEntry,
  readStagedPacks,
  upsertPackIndex,
  versionBase,
} from "./pack-index.mjs";

const BASE = "https://packs.example.app";
const manifest = (id, version, extra = {}) => ({
  id,
  version,
  kind: "hero",
  name: id === "carnage-nep" ? "Carnage" : "Gwenpool",
  authors: ["Neptune", "Someone"],
  description: "Fan-made hero pack.\nSecond line.",
  requires: { app: ">=0.1.0", dslFeatures: [], packs: [] },
  ...extra,
});
const entry = (id, version, sha = "a".repeat(64), opts = {}) =>
  packIndexEntry({
    manifest: manifest(id, version, opts.manifest),
    base: versionBase(BASE, id, version),
    zipBytes: 100,
    zipSha256: sha,
    hasPreview: opts.hasPreview ?? true,
    hasThumb: opts.hasThumb ?? true,
    approved: "2026-11-11",
  });
const at = { today: "2026-11-11", now: "2026-11-11T12:00:00Z" };

describe("packIndexEntry", () => {
  it("writes the §11.5 entry with URLs under the version's base", () => {
    const e = entry("carnage-nep", "3.0.0");
    assert.equal(e.creator, "Neptune");
    assert.equal(e.summary, "Fan-made hero pack.");
    assert.deepEqual(e.tags, ["hero"]);
    assert.equal(e.thumbnail, `${BASE}/carnage-nep/3.0.0/thumb.webp`);
    assert.equal(e.latest, "3.0.0");
    assert.equal(e.withdrawn, false);
    assert.deepEqual(e.versions["3.0.0"], {
      manifest: `${BASE}/carnage-nep/3.0.0/pack.json`,
      base: `${BASE}/carnage-nep/3.0.0/`,
      zip: `${BASE}/carnage-nep/3.0.0/carnage-nep-3.0.0.zip`,
      zipBytes: 100,
      zipSha256: "a".repeat(64),
      requires: { app: ">=0.1.0", dslFeatures: [], packs: [] },
      preview: `${BASE}/carnage-nep/3.0.0/preview.json`,
    });
  });

  it("leaves out the thumbnail and preview a build didn't write", () => {
    const e = entry("carnage-nep", "3.0.0", undefined, { hasPreview: false, hasThumb: false });
    assert.equal("thumbnail" in e, false);
    assert.equal("preview" in e.versions["3.0.0"], false);
  });
});

describe("compareVersions", () => {
  it("orders by number, a pre-release before its release", () => {
    const sorted = ["1.10.0", "1.2.0", "2.0.0", "1.2.0-beta", "1.2.1"].sort(compareVersions);
    assert.deepEqual(sorted, ["1.2.0-beta", "1.2.0", "1.2.1", "1.10.0", "2.0.0"]);
  });
});

describe("upsertPackIndex", () => {
  it("starts a catalog when there is none", () => {
    const index = upsertPackIndex(undefined, [entry("gwenpool-ptt", "1.0.0"), entry("carnage-nep", "3.0.0")], at);
    assert.equal(index.schema, PACK_INDEX_SCHEMA);
    assert.equal(index.generated, at.now);
    assert.deepEqual(
      index.packs.map((p) => p.name),
      ["Carnage", "Gwenpool"],
    );
  });

  it("keeps packs it didn't build, older versions and the first approval date", () => {
    const other = { ...entry("gwenpool-ptt", "1.0.0"), approved: "2026-11-01" };
    const old = { ...entry("carnage-nep", "2.0.0", "b".repeat(64)), approved: "2026-11-05" };
    const current = { schema: 2, generated: "x", packs: [old, other] };
    const index = upsertPackIndex(current, [entry("carnage-nep", "3.0.0")], { ...at, today: "2026-12-01" });
    const carnage = index.packs.find((p) => p.id === "carnage-nep");
    assert.deepEqual(Object.keys(carnage.versions).sort(), ["2.0.0", "3.0.0"]);
    assert.equal(carnage.latest, "3.0.0");
    assert.equal(carnage.approved, "2026-11-05");
    assert.deepEqual(
      index.packs.find((p) => p.id === "gwenpool-ptt"),
      other,
    );
  });

  it("is a no-op for a version already published with the same zip", () => {
    const current = upsertPackIndex(undefined, [entry("carnage-nep", "3.0.0")], at);
    const again = upsertPackIndex(current, [entry("carnage-nep", "3.0.0")], at);
    assert.deepEqual(again.packs, current.packs);
  });

  it("refuses a published version with a different zip", () => {
    const current = upsertPackIndex(undefined, [entry("carnage-nep", "3.0.0")], at);
    assert.throws(
      () => upsertPackIndex(current, [entry("carnage-nep", "3.0.0", "c".repeat(64))], at),
      /bump the version/,
    );
  });

  it("keeps the newest version's fields when an older version is added", () => {
    const current = upsertPackIndex(undefined, [entry("carnage-nep", "3.0.0")], at);
    const older = entry("carnage-nep", "2.5.0", "d".repeat(64), { manifest: { name: "Old name" } });
    const carnage = upsertPackIndex(current, [older], at).packs[0];
    assert.equal(carnage.latest, "3.0.0");
    assert.equal(carnage.name, "Carnage");
    assert.equal(carnage.thumbnail, `${BASE}/carnage-nep/3.0.0/thumb.webp`);
    assert.ok(carnage.versions["2.5.0"]);
  });

  it("lists a withdrawn pack again when it is published", () => {
    const current = upsertPackIndex(undefined, [entry("carnage-nep", "3.0.0")], at);
    current.packs[0].withdrawn = true;
    assert.equal(
      upsertPackIndex(current, [entry("carnage-nep", "3.1.0", "e".repeat(64))], at).packs[0].withdrawn,
      false,
    );
  });

  it("refuses a catalog of another schema", () => {
    assert.throws(() => upsertPackIndex({ schema: 1, packs: [] }, [], at), /schema 1/);
    assert.throws(() => upsertPackIndex({ schema: 2 }, [], at), /no packs list/);
  });
});

describe("readStagedPacks", () => {
  const temps = [];
  after(() => Promise.all(temps.map((dir) => fs.rm(dir, { recursive: true, force: true }))));

  it("reads each staged <id>/<version>/ folder", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mc-pack-index-test-"));
    temps.push(dir);
    const at1 = path.join(dir, "carnage-nep", "3.0.0");
    await fs.mkdir(at1, { recursive: true });
    await fs.writeFile(path.join(at1, "pack.json"), JSON.stringify(manifest("carnage-nep", "3.0.0")));
    await fs.writeFile(path.join(at1, "carnage-nep-3.0.0.zip"), "zip bytes");
    await fs.writeFile(path.join(at1, "preview.json"), "{}");
    const [e] = await readStagedPacks(dir, `${BASE}/`, "2026-11-11");
    assert.equal(e.versions["3.0.0"].zipBytes, 9);
    assert.equal(e.versions["3.0.0"].zipSha256, createHash("sha256").update("zip bytes").digest("hex"));
    assert.equal(e.versions["3.0.0"].preview, `${BASE}/carnage-nep/3.0.0/preview.json`);
    assert.equal("thumbnail" in e, false);
  });

  it("refuses a pack.json that doesn't match its folder", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mc-pack-index-test-"));
    temps.push(dir);
    const at1 = path.join(dir, "carnage-nep", "3.0.1");
    await fs.mkdir(at1, { recursive: true });
    await fs.writeFile(path.join(at1, "pack.json"), JSON.stringify(manifest("carnage-nep", "3.0.0")));
    await assert.rejects(readStagedPacks(dir, BASE, "2026-11-11"), /says carnage-nep 3\.0\.0/);
  });
});
