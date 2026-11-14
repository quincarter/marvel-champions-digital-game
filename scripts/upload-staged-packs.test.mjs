// node --test scripts/ (pnpm test:scripts). publish-packs.yml's upload: immutable versions, re-running after a failure
// part way, and racing the registry repo's publisher for one new version, with the bucket faked.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { awsStore, publishStaged, readStaged } from "./upload-staged-packs.mjs";

const root = mkdtempSync(join(tmpdir(), "upload-staged-packs-"));
after(() => rmSync(root, { recursive: true, force: true }));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (path, body) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
};

let n = 0;
/** A staging folder (the build job's `<staging>/<id>/<version>/`) with one pack; `other` overrides non-zip bytes. */
function staged(id = "fan-gwenpool", version = "1.0.0", zipBody = "zip bytes", other = {}) {
  const dir = join(root, `staging-${n++}`);
  const at = join(dir, id, version);
  write(join(at, "pack.json"), other.manifest ?? JSON.stringify({ id, version }));
  write(join(at, `${id}-${version}.zip`), zipBody);
  write(join(at, "preview.json"), other.preview ?? "{}");
  write(join(at, "thumb.webp"), other.thumb ?? "thumb");
  write(join(at, "cards", "en", "01a.webp"), other.card ?? "a");
  return dir;
}

/**
 * An in-memory bucket whose every put honours If-None-Match like R2; `failOn(key)` makes the put of that key throw
 * once, like a dropped connection. Two stores over one `objects` map are two publishers writing the same bucket;
 * `beforePut` runs before each put (a hook to line two publishers up after both have planned).
 */
function fakeStore(objects = new Map(), { beforePut = async () => {} } = {}) {
  let failKey;
  const puts = [];
  return {
    objects,
    puts,
    failOn: (key) => (failKey = key),
    async sha256(key) {
      const object = objects.get(key);
      return object ? object.sha256 : null;
    },
    async put(file) {
      await beforePut();
      puts.push(file.key);
      if (file.key === failKey) {
        failKey = undefined;
        throw new Error(`upload of ${file.key} failed`);
      }
      if (objects.has(file.key)) return "exists";
      objects.set(file.key, { body: readFileSync(file.path), sha256: file.sha256 });
      return "written";
    },
  };
}

/** Resolves once `count` callers are waiting on it: both publishers have planned before either uploads. */
function barrier(count) {
  let waiting = 0;
  let release;
  const all = new Promise((resolve) => (release = resolve));
  return async () => {
    if (++waiting === count) release();
    await all;
  };
}

describe("readStaged", () => {
  it("lists every file to upload under <id>/<version>/, the zip last", () => {
    const [pack] = readStaged(staged());
    assert.deepEqual(
      pack.files.map((f) => f.key),
      [
        "fan-gwenpool/1.0.0/pack.json",
        "fan-gwenpool/1.0.0/preview.json",
        "fan-gwenpool/1.0.0/thumb.webp",
        "fan-gwenpool/1.0.0/cards/en/01a.webp",
        "fan-gwenpool/1.0.0/fan-gwenpool-1.0.0.zip",
      ],
    );
    assert.equal(pack.zipSha, sha("zip bytes"));
    assert.equal(pack.files[2].sha256, sha("thumb"));
    assert.equal(pack.files[3].name, "cards/en/01a.webp");
  });

  it("finds no packs in an empty staging folder, or no folder", () => {
    const dir = join(root, "empty");
    mkdirSync(dir, { recursive: true });
    assert.deepEqual(readStaged(dir), []);
    assert.deepEqual(readStaged(join(root, "missing")), []);
  });

  it("refuses a staged pack.json that names another id or version than its folder", () => {
    const manifest = JSON.stringify({ id: "fan-gwenpool", version: "2.0.0" });
    assert.throws(() => readStaged(staged("fan-gwenpool", "1.0.0", "zip", { manifest })), /pack\.json says/);
  });
});

describe("publishStaged", () => {
  it("uploads a new version, the zip last", async () => {
    const store = fakeStore();
    const done = await publishStaged(readStaged(staged()), { store });
    assert.deepEqual(done, [{ id: "fan-gwenpool", version: "1.0.0", action: "upload" }]);
    assert.equal(store.objects.size, 5);
    assert.equal(store.puts.at(-1), "fan-gwenpool/1.0.0/fan-gwenpool-1.0.0.zip");
    assert.equal(store.objects.get("fan-gwenpool/1.0.0/fan-gwenpool-1.0.0.zip").sha256, sha("zip bytes"));
  });

  it("does nothing and succeeds when nothing is staged", async () => {
    assert.deepEqual(await publishStaged([], { store: fakeStore() }), []);
  });

  it("skips a version already published with the same files", async () => {
    const store = fakeStore();
    const packs = readStaged(staged());
    await publishStaged(packs, { store });
    store.puts.length = 0;
    assert.deepEqual(await publishStaged(packs, { store }), [{ id: "fan-gwenpool", version: "1.0.0", action: "skip" }]);
    assert.deepEqual(store.puts, []);
  });

  it("only checks with check: true, uploading nothing", async () => {
    const store = fakeStore();
    const lines = [];
    const done = await publishStaged(readStaged(staged()), { store, check: true, log: (line) => lines.push(line) });
    assert.deepEqual(done, [{ id: "fan-gwenpool", version: "1.0.0", action: "upload" }]);
    assert.deepEqual(store.puts, []);
    assert.match(lines[0], /new/);
  });

  it("fails a check on a version published with other bytes", async () => {
    const store = fakeStore();
    await publishStaged(readStaged(staged("fan-gwenpool", "1.0.0", "first")), { store });
    await assert.rejects(
      publishStaged(readStaged(staged("fan-gwenpool", "1.0.0", "second")), { store, check: true }),
      /already published with a different zip/,
    );
  });

  it("re-uploads a version whose zip never made it (a failure part way through the files)", async () => {
    const store = fakeStore();
    const packs = readStaged(staged());
    store.failOn("fan-gwenpool/1.0.0/fan-gwenpool-1.0.0.zip");
    await assert.rejects(publishStaged(packs, { store }), /upload of .* failed/);
    store.puts.length = 0;
    const done = await publishStaged(packs, { store });
    assert.equal(done[0].action, "upload");
    assert.deepEqual(store.puts, ["fan-gwenpool/1.0.0/fan-gwenpool-1.0.0.zip"]);
  });

  it("refuses a version already published with a different zip, before uploading anything", async () => {
    const store = fakeStore();
    await publishStaged(readStaged(staged("fan-gwenpool", "1.0.0", "first")), { store });
    const before = store.objects.size;
    const changed = [...readStaged(staged("fan-a", "1.0.0")), ...readStaged(staged("fan-gwenpool", "1.0.0", "second"))];
    await assert.rejects(publishStaged(changed, { store }), /already published with a different zip/);
    assert.equal(store.objects.size, before, "fan-a was not uploaded either");
  });

  it("refuses a version whose zip never made it but whose other files are there with other bytes", async () => {
    // Another build's pack.json and thumbnail, left by a run that stopped before its zip.
    const store = fakeStore();
    const theirs = readStaged(staged("fan-gwenpool", "1.0.0", "zip", { thumb: "their thumb" }))[0];
    for (const file of theirs.files.filter((f) => f.name !== theirs.zipName)) await store.put(file);
    const before = store.objects.size;
    await assert.rejects(
      publishStaged(readStaged(staged("fan-gwenpool", "1.0.0", "zip", { thumb: "our thumb" })), { store }),
      /already published with a different thumb\.webp/,
    );
    assert.equal(store.objects.size, before, "nothing was uploaded");
  });

  it("refuses a version whose zip matches but whose card picture differs", async () => {
    const store = fakeStore();
    await publishStaged(readStaged(staged("fan-gwenpool", "1.0.0", "zip", { card: "one" })), { store });
    await assert.rejects(
      publishStaged(readStaged(staged("fan-gwenpool", "1.0.0", "zip", { card: "two" })), { store }),
      /already published with a different cards\/en\/01a\.webp/,
    );
  });

  it("uploads only the files a stopped run left out, keeping the ones it wrote", async () => {
    const store = fakeStore();
    const packs = readStaged(staged());
    store.failOn("fan-gwenpool/1.0.0/thumb.webp");
    await assert.rejects(publishStaged(packs, { store }), /upload of .* failed/);
    store.puts.length = 0;
    await publishStaged(packs, { store });
    assert.deepEqual(store.puts, [
      "fan-gwenpool/1.0.0/thumb.webp",
      "fan-gwenpool/1.0.0/cards/en/01a.webp",
      "fan-gwenpool/1.0.0/fan-gwenpool-1.0.0.zip",
    ]);
  });
});

describe("two publishers of one new version at once (this repo and the registry)", () => {
  const zipKey = "fan-gwenpool/1.0.0/fan-gwenpool-1.0.0.zip";

  /** Both publishers plan against an empty bucket, then upload side by side. */
  const race = (...stagingDirs) => {
    const objects = new Map();
    const beforePut = barrier(stagingDirs.length);
    return Promise.allSettled(
      stagingDirs.map((dir) => publishStaged(readStaged(dir), { store: fakeStore(objects, { beforePut }) })),
    ).then((results) => ({ objects, results }));
  };

  it("keeps the first zip and fails the other publisher when the zips differ", async () => {
    const { objects, results } = await race(
      staged("fan-gwenpool", "1.0.0", "game repo zip"),
      staged("fan-gwenpool", "1.0.0", "registry zip"),
    );
    assert.deepEqual(
      results.map((r) => r.status),
      ["fulfilled", "rejected"],
    );
    assert.match(results[1].reason.message, /published by someone else .* with a different zip/);
    const zip = objects.get(zipKey);
    assert.equal(zip.sha256, sha("game repo zip"));
    assert.equal(sha(zip.body), zip.sha256, "the bucket's zip is the bytes its sha256 names");
  });

  it("lets both finish when they upload the same files", async () => {
    const { objects, results } = await race(
      staged("fan-gwenpool", "1.0.0", "same zip"),
      staged("fan-gwenpool", "1.0.0", "same zip"),
    );
    assert.deepEqual(
      results.map((r) => r.status === "fulfilled" && r.value[0].action),
      ["upload", "upload"],
    );
    assert.equal(objects.get(zipKey).sha256, sha("same zip"));
  });

  it("never mixes their files when the same zip comes with different pictures and preview", async () => {
    const ours = { preview: '{"cards":1}', thumb: "game repo thumb", card: "game repo card" };
    const theirs = { preview: '{"cards":2}', thumb: "registry thumb", card: "registry card" };
    const { objects, results } = await race(
      staged("fan-gwenpool", "1.0.0", "same zip", ours),
      staged("fan-gwenpool", "1.0.0", "same zip", theirs),
    );
    assert.deepEqual(
      results.map((r) => r.status),
      ["fulfilled", "rejected"],
    );
    assert.match(results[1].reason.message, /published by someone else .* with a different preview\.json/);
    const body = (name) => String(objects.get(`fan-gwenpool/1.0.0/${name}`).body);
    assert.equal(body("preview.json"), ours.preview);
    assert.equal(body("thumb.webp"), ours.thumb);
    assert.equal(body("cards/en/01a.webp"), ours.card);
    for (const [key, object] of objects) assert.equal(sha(object.body), object.sha256, `${key} matches its sha256`);
  });

  it("never mixes their files when only a card picture differs, and only one finishes", async () => {
    const { objects, results } = await race(
      staged("fan-gwenpool", "1.0.0", "same zip", { card: "game repo card" }),
      staged("fan-gwenpool", "1.0.0", "same zip", { card: "registry card" }),
    );
    assert.deepEqual(
      results.map((r) => r.status),
      ["fulfilled", "rejected"],
    );
    assert.match(results[1].reason.message, /with a different cards\/en\/01a\.webp/);
    assert.equal(String(objects.get("fan-gwenpool/1.0.0/cards/en/01a.webp").body), "game repo card");
    assert.equal(objects.get(zipKey).sha256, sha("same zip"));
  });
});

describe("awsStore", () => {
  const exec = (responses) => async (_file, args) => responses[args[1]](args);

  it("reads the stored sha256 metadata, and treats a 404 as no object", async () => {
    const store = awsStore({
      endpoint: "e",
      bucket: "b",
      dir: root,
      exec: exec({
        "head-object": (args) =>
          args.includes("missing")
            ? { code: 254, stdout: "", stderr: "An error occurred (404) when calling the HeadObject operation" }
            : { code: 0, stdout: JSON.stringify({ Metadata: { sha256: "c".repeat(64) } }), stderr: "" },
      }),
    });
    assert.equal(await store.sha256("missing"), null);
    assert.equal(await store.sha256("there"), "c".repeat(64));
  });

  it("downloads and hashes an object uploaded without the metadata", async () => {
    const store = awsStore({
      endpoint: "e",
      bucket: "b",
      dir: root,
      exec: exec({
        "head-object": () => ({ code: 0, stdout: JSON.stringify({ Metadata: {} }), stderr: "" }),
        cp: (args) => {
          writeFileSync(args[4], "old zip");
          return { code: 0, stdout: "", stderr: "" };
        },
      }),
    });
    assert.equal(await store.sha256("k"), sha("old zip"));
  });

  it("puts every file with If-None-Match: * and its sha256; a 412 or 409 is an object already there", async () => {
    const calls = [];
    const failed = (code) => ({ code: 254, stdout: "", stderr: `An error occurred (${code}) when calling PutObject` });
    const replies = [
      { code: 0, stdout: "{}", stderr: "" },
      failed("PreconditionFailed"),
      failed("ConditionalRequestConflict"),
      { code: 255, stdout: "", stderr: "An error occurred (AccessDenied)" },
    ];
    const store = awsStore({
      endpoint: "e",
      bucket: "b",
      dir: root,
      exec: async (_file, args) => {
        calls.push(args);
        return replies[calls.length - 1];
      },
    });
    const thumb = { path: "t.webp", key: "p/1.0.0/thumb.webp", contentType: "image/webp", sha256: "d".repeat(64) };
    assert.equal(await store.put(thumb), "written");
    assert.equal(await store.put(thumb), "exists");
    assert.equal(await store.put(thumb), "exists");
    await assert.rejects(store.put(thumb), /AccessDenied/);
    assert.deepEqual(calls[0].slice(0, 2), ["s3api", "put-object"]);
    const line = calls[0].join(" ");
    assert.ok(line.includes("--if-none-match *"));
    assert.ok(line.includes(`--metadata sha256=${"d".repeat(64)}`));
    assert.ok(line.includes("--content-type image/webp"));
    assert.ok(line.includes("--cache-control public, max-age=31536000, immutable"));
  });

  it("fails on any other head-object error", async () => {
    const store = awsStore({
      endpoint: "e",
      bucket: "b",
      dir: root,
      exec: exec({ "head-object": () => ({ code: 255, stdout: "", stderr: "An error occurred (403): Forbidden" }) }),
    });
    await assert.rejects(store.sha256("k"), /Forbidden/);
  });
});
