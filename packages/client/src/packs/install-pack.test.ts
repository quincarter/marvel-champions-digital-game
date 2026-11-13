import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { installPack, type InstallProgress } from "./install-pack.js";
import { IdbPackStore } from "./pack-store.js";
import { buildPack } from "./test-zip.js";
import { PackInstallError } from "./unpack-pack.js";

const noWorker = () => null;
const respond = (bytes: Uint8Array) => async () => new Response(bytes as Uint8Array<ArrayBuffer>);
const freshStore = (opts = {}) => new IdbPackStore({ factory: new IDBFactory(), ...opts });

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof PackInstallError ? error.code : `other:${String(error)}`;
  }
  return undefined;
}

describe("installPack", () => {
  it("downloads, verifies, stores, and reports progress", async () => {
    const built = buildPack();
    const store = freshStore();
    const seen: InstallProgress[] = [];
    const installed = await installPack(built.entry, {
      store,
      fetch: respond(built.zip),
      workerFactory: noWorker,
      onProgress: (p) => seen.push(p),
    });
    expect(installed.id).toBe("fan-test");
    expect((await store.get("fan-test"))?.version).toBe("1.0.0");
    const blob = await store.fileBlob("fan-test", "pictures/hero.webp");
    expect(blob?.size).toBe(8);
    const phases = seen.map((p) => p.phase);
    expect(phases[0]).toBe("download");
    expect(phases).toEqual(expect.arrayContaining(["verify-zip", "unzip", "verify-files", "store", "done"]));
    const download = seen.find((p) => p.phase === "download");
    expect(download).toMatchObject({ received: built.zip.byteLength, total: built.zip.byteLength });
  });

  it("rejects a wrong zip checksum and installs nothing", async () => {
    const built = buildPack();
    const bad = {
      ...built.entry,
      versions: { "1.0.0": { ...built.entry.versions["1.0.0"]!, zipSha256: "0".repeat(64) } },
    };
    const store = freshStore();
    expect(await codeOf(installPack(bad, { store, fetch: respond(built.zip), workerFactory: noWorker }))).toBe(
      "zip-hash",
    );
    expect(await store.list()).toEqual([]);
  });

  it("rejects a wrong zip size", async () => {
    const built = buildPack();
    const bad = { ...built.entry, versions: { "1.0.0": { ...built.entry.versions["1.0.0"]!, zipBytes: 5 } } };
    expect(
      await codeOf(installPack(bad, { store: freshStore(), fetch: respond(built.zip), workerFactory: noWorker })),
    ).toBe("zip-size");
  });

  it("rejects a tampered file (same size, different bytes)", async () => {
    const built = buildPack({ tamper: { "pictures/hero.webp": new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9]) } });
    const store = freshStore();
    // The catalog entry hashes the tampered zip, so the zip check passes and the per-file hash is what catches it.
    expect(await codeOf(installPack(built.entry, { store, fetch: respond(built.zip), workerFactory: noWorker }))).toBe(
      "file-hash",
    );
    expect(await store.list()).toEqual([]);
  });

  it("rejects a file whose size differs from the manifest", async () => {
    const built = buildPack({ tamper: { "pictures/hero.webp": new Uint8Array([1, 2]) } });
    expect(
      await codeOf(
        installPack(built.entry, { store: freshStore(), fetch: respond(built.zip), workerFactory: noWorker }),
      ),
    ).toBe("file-size");
  });

  it("rejects an unsafe path", async () => {
    const built = buildPack({ extra: { "../evil.txt": new Uint8Array([1]) } });
    const store = freshStore();
    expect(await codeOf(installPack(built.entry, { store, fetch: respond(built.zip), workerFactory: noWorker }))).toBe(
      "unsafe-path",
    );
    expect(await store.list()).toEqual([]);
  });

  it("rejects a file the manifest does not list", async () => {
    const built = buildPack({ extra: { "extra.txt": new Uint8Array([1]) } });
    expect(
      await codeOf(
        installPack(built.entry, { store: freshStore(), fetch: respond(built.zip), workerFactory: noWorker }),
      ),
    ).toBe("unlisted-file");
  });

  it("rejects a pack.json that is not the catalog's version", async () => {
    const built = buildPack({ manifestOverride: { version: "2.0.0" } });
    expect(
      await codeOf(
        installPack(built.entry, { store: freshStore(), fetch: respond(built.zip), workerFactory: noWorker }),
      ),
    ).toBe("mismatch");
  });

  it("rejects a zip with no pack.json", async () => {
    const zip = zipSync({ "a.txt": new Uint8Array([1]) });
    const built = buildPack();
    const { createHash } = await import("node:crypto");
    const entry = {
      ...built.entry,
      versions: {
        "1.0.0": {
          ...built.entry.versions["1.0.0"]!,
          zipBytes: zip.byteLength,
          zipSha256: createHash("sha256").update(zip).digest("hex"),
        },
      },
    };
    expect(
      await codeOf(installPack(entry, { store: freshStore(), fetch: respond(zip), workerFactory: noWorker })),
    ).toBe("manifest");
  });

  it("leaves nothing installed when the store write is interrupted, and keeps an older install", async () => {
    const v1 = buildPack({ version: "1.0.0" });
    const v2 = buildPack({ version: "1.1.0" });
    const factory = new IDBFactory();
    const good = new IdbPackStore({ factory });
    await installPack(v1.entry, { store: good, fetch: respond(v1.zip), workerFactory: noWorker });
    await good.close();

    const flaky = new IdbPackStore({
      factory,
      beforeManifest: () => {
        throw new Error("disk full");
      },
    });
    expect(await codeOf(installPack(v2.entry, { store: flaky, fetch: respond(v2.zip), workerFactory: noWorker }))).toBe(
      "store",
    );
    expect((await flaky.get("fan-test"))?.version).toBe("1.0.0");
    expect(await flaky.fileBlob("fan-test", "data/cards.json")).toBeDefined();
    expect(await flaky.packBytes("fan-test")).toBe(Object.values(v1.contents).reduce((n, b) => n + b.byteLength, 0));
  });

  it("leaves nothing installed on a first install that is interrupted", async () => {
    const built = buildPack();
    const store = freshStore({
      beforeManifest: () => {
        throw new Error("boom");
      },
    });
    await codeOf(installPack(built.entry, { store, fetch: respond(built.zip), workerFactory: noWorker }));
    expect(await store.list()).toEqual([]);
    expect(await store.totalBytes()).toBe(0);
  });

  it("falls back to zipFallback when the first address fails", async () => {
    const built = buildPack({ zipFallback: "https://mirror.test/pack.zip" });
    const asked: string[] = [];
    const store = freshStore();
    await installPack(built.entry, {
      store,
      workerFactory: noWorker,
      fetch: async (url) => {
        asked.push(url);
        if (url.startsWith("https://packs.test")) throw new TypeError("network");
        return new Response(built.zip as Uint8Array<ArrayBuffer>);
      },
    });
    expect(asked).toEqual([built.entry.versions["1.0.0"]!.zip, "https://mirror.test/pack.zip"]);
    expect(await store.get("fan-test")).toBeDefined();
  });

  it("reports a download error when every address fails", async () => {
    const built = buildPack({ zipFallback: "https://mirror.test/pack.zip" });
    const code = await codeOf(
      installPack(built.entry, {
        store: freshStore(),
        workerFactory: noWorker,
        fetch: async () => new Response("nope", { status: 404 }),
      }),
    );
    expect(code).toBe("download");
  });
});
