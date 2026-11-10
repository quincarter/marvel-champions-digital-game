import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCatalog } from "./catalog.js";
import { installPack } from "./install-pack.js";
import { IdbPackStore } from "./pack-store.js";
import { buildPack } from "./test-zip.js";
import { unpackInWorker, type UnpackWorkerLike, type UnpackWorkerReply } from "./unpack-client.js";
import { MAX_MANIFEST_BYTES, PackInstallError, unpackPack } from "./unpack-pack.js";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const respond = (bytes: Uint8Array) => async () => new Response(bytes as Uint8Array<ArrayBuffer>);
const noWorker = () => null;

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof PackInstallError ? error.code : `other:${String(error)}`;
  }
  return undefined;
}

const expectOf = (built: ReturnType<typeof buildPack>) => {
  const v = built.entry.versions[built.entry.latest]!;
  return { id: built.entry.id, version: built.entry.latest, zipBytes: v.zipBytes, zipSha256: v.zipSha256 };
};

/** A zip whose pack.json is `manifest`, with the catalog expectation computed to match the zip. */
function zipWith(manifest: unknown) {
  const built = buildPack();
  const zip = zipSync({ "pack.json": new TextEncoder().encode(JSON.stringify(manifest)), ...built.contents });
  return { zip, expect: { ...expectOf(built), zipBytes: zip.byteLength, zipSha256: sha(zip) } };
}

describe("unpackPack manifest and path checks", () => {
  it("rejects a manifest listing a file the zip lacks", async () => {
    const built = buildPack({ omit: ["pictures/hero.webp"] });
    expect(await codeOf(unpackPack(built.zip, expectOf(built)))).toBe("missing-file");
  });

  it("rejects an unsafe path in the manifest list", async () => {
    const built = buildPack();
    const files = [...built.manifest.files, { path: "../x", bytes: 1, sha256: "0".repeat(64) }];
    const { zip, expect: ex } = zipWith({ ...built.manifest, files, totalBytes: built.manifest.totalBytes + 1 });
    expect(await codeOf(unpackPack(zip, ex))).toBe("unsafe-path");
  });

  it("rejects absolute and backslash entry names in a real zip", async () => {
    for (const name of ["/abs.txt", "a\\b.txt"]) {
      const built = buildPack({ extra: { [name]: new Uint8Array([1]) } });
      expect(await codeOf(unpackPack(built.zip, expectOf(built)))).toBe("unsafe-path");
    }
  });

  it("checks the shape of pack.json", async () => {
    const m = buildPack().manifest;
    const cases: unknown[] = [
      { ...m, schema: 2 },
      { ...m, kind: "weird" },
      { ...m, id: "Bad Id" },
      { ...m, requires: { app: ">=0.1.0" } },
      { ...m, totalBytes: m.totalBytes + 1 },
      { ...m, contents: { cards: "data/missing.json" } },
      { ...m, files: [m.files[0], m.files[0]] },
    ];
    for (const bad of cases) {
      const { zip, expect: ex } = zipWith(bad);
      expect(await codeOf(unpackPack(zip, ex))).toBe("manifest");
    }
  });

  it("compares kind and requires.app with the catalog", async () => {
    const built = buildPack();
    expect(await codeOf(unpackPack(built.zip, { ...expectOf(built), kind: "scenario" }))).toBe("mismatch");
    expect(await codeOf(unpackPack(built.zip, { ...expectOf(built), requiresApp: ">=9.0.0" }))).toBe("mismatch");
    await unpackPack(built.zip, { ...expectOf(built), kind: "hero", requiresApp: ">=0.1.0" });
  });

  it("refuses an oversize pack.json before inflating it", async () => {
    const built = buildPack();
    const zip = zipSync({ "pack.json": new Uint8Array(MAX_MANIFEST_BYTES + 10).fill(32) });
    const ex = { ...expectOf(built), zipBytes: zip.byteLength, zipSha256: sha(zip) };
    expect(await codeOf(unpackPack(zip, ex))).toBe("too-large");
  });

  it("refuses a pack that declares more than the absolute ceiling", async () => {
    const m = buildPack().manifest;
    const big = 600 * 1024 * 1024;
    const files = [{ ...m.files[0]!, bytes: big }];
    const { zip, expect: ex } = zipWith({ ...m, files, totalBytes: big, contents: { cards: files[0]!.path } });
    expect(await codeOf(unpackPack(zip, ex))).toBe("too-large");
  });
});

describe("catalog checks", () => {
  const good = buildPack().entry;
  const v = good.versions["1.0.0"]!;
  const count = (patch: object) =>
    parseCatalog({ schema: 2, generated: "x", packs: [{ ...good, ...patch }] })!.packs.length;

  it("drops entries with bad ids, latest, sizes, hashes or version keys", () => {
    expect(count({})).toBe(1);
    expect(count({ id: "Bad_Id" })).toBe(0);
    expect(count({ latest: "9.9.9" })).toBe(0);
    expect(count({ versions: { "1.0.0": { ...v, zipBytes: 0 } } })).toBe(0);
    expect(count({ versions: { "1.0.0": { ...v, zipBytes: 1.5 } } })).toBe(0);
    expect(count({ versions: { "1.0.0": { ...v, zipSha256: "ABC" } } })).toBe(0);
    expect(count({ versions: { "1.0.0": { ...v, zipSha256: "A".repeat(64) } } })).toBe(0);
    expect(count({ latest: "latest", versions: { latest: v } })).toBe(0);
  });
});

describe("install fallbacks", () => {
  it("falls back to zipFallback when the first address serves bad bytes", async () => {
    const built = buildPack({ zipFallback: "https://mirror.test/pack.zip" });
    const bad = new Uint8Array(built.zip);
    bad[bad.length - 1] = bad[bad.length - 1]! ^ 0xff; // same size, wrong sha
    const asked: string[] = [];
    const store = new IdbPackStore({ factory: new IDBFactory() });
    await installPack(built.entry, {
      store,
      workerFactory: noWorker,
      fetch: async (url) => {
        asked.push(url);
        return new Response((url.includes("mirror") ? built.zip : bad) as Uint8Array<ArrayBuffer>);
      },
    });
    expect(asked).toHaveLength(2);
    expect(await store.get("fan-test")).toBeDefined();
  });

  it("reports the checksum error when every address serves bad bytes", async () => {
    const built = buildPack();
    const bad = new Uint8Array(built.zip);
    bad[0] = bad[0]! ^ 0xff;
    const store = new IdbPackStore({ factory: new IDBFactory() });
    expect(await codeOf(installPack(built.entry, { store, workerFactory: noWorker, fetch: respond(bad) }))).toBe(
      "zip-hash",
    );
  });

  it("stops an oversize download as soon as it passes the size", async () => {
    const built = buildPack();
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(built.zip.byteLength));
        if (pulled > 50) controller.close();
      },
    });
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const code = await codeOf(
      installPack(built.entry, { store, workerFactory: noWorker, fetch: async () => new Response(body) }),
    );
    expect(code).toBe("zip-size");
    expect(pulled).toBeLessThan(10);
  });

  it("refuses a withdrawn entry", async () => {
    const built = buildPack();
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const entry = { ...built.entry, withdrawn: true };
    expect(await codeOf(installPack(entry, { store, workerFactory: noWorker, fetch: respond(built.zip) }))).toBe(
      "withdrawn",
    );
  });
});

class FakeWorker implements UnpackWorkerLike {
  onmessage: UnpackWorkerLike["onmessage"] = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  onerror: UnpackWorkerLike["onerror"] = null;
  terminated = false;
  constructor(private readonly onPost: (w: FakeWorker) => void = () => {}) {}
  postMessage(): void {
    this.onPost(this);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(data: UnpackWorkerReply): void {
    this.onmessage?.({ data });
  }
}

describe("unpackInWorker", () => {
  afterEach(() => vi.useRealTimers());

  it("forwards progress and resolves with the worker result", async () => {
    const built = buildPack();
    const progress: string[] = [];
    const worker = new FakeWorker((w) => {
      w.reply({ kind: "progress", progress: { step: "unzip" } });
      w.reply({ kind: "done", manifest: built.manifest, files: new Map() });
    });
    const result = await unpackInWorker(
      built.zip,
      expectOf(built),
      (p) => progress.push(p.step),
      () => worker,
    );
    expect(result.manifest.id).toBe("fan-test");
    expect(progress).toEqual(["unzip"]);
    expect(worker.terminated).toBe(true);
  });

  it("maps a worker error reply to a PackInstallError with its code", async () => {
    const built = buildPack();
    const worker = new FakeWorker((w) => w.reply({ kind: "error", code: "file-hash", message: "bad" }));
    expect(await codeOf(unpackInWorker(built.zip, expectOf(built), undefined, () => worker))).toBe("file-hash");
  });

  it("falls back to unpacking here on an error, a messageerror or a throwing postMessage", async () => {
    const built = buildPack();
    const throwing = new FakeWorker();
    throwing.postMessage = () => {
      throw new Error("clone");
    };
    for (const worker of [
      new FakeWorker((w) => w.onerror?.({})),
      new FakeWorker((w) => w.onmessageerror?.({})),
      throwing,
    ]) {
      const result = await unpackInWorker(built.zip, expectOf(built), undefined, () => worker);
      expect(result.files.size).toBe(2);
      expect(worker.terminated).toBe(true);
    }
  });

  it("falls back to unpacking here when the worker goes silent", async () => {
    vi.useFakeTimers();
    const built = buildPack();
    const worker = new FakeWorker();
    const pending = unpackInWorker(built.zip, expectOf(built), undefined, () => worker, 1000);
    await vi.advanceTimersByTimeAsync(1001);
    vi.useRealTimers();
    expect((await pending).files.size).toBe(2);
    expect(worker.terminated).toBe(true);
  });
});
