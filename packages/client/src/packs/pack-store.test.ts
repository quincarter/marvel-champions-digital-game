import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdbPackStore, packFileKey } from "./pack-store.js";
import { buildPack } from "./test-zip.js";

const filesOf = (contents: Record<string, Uint8Array>) => new Map(Object.entries(contents));

describe("IdbPackStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("revokes object URLs when a pack is reinstalled or removed", async () => {
    let n = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:test/${++n}`);
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const { manifest, contents } = buildPack();
    await store.install(manifest, filesOf(contents));
    const first = await store.objectUrl("fan-test", "pictures/hero.webp");
    await store.install(manifest, filesOf(contents));
    expect(revoked).toHaveBeenCalledWith(first);
    const second = await store.objectUrl("fan-test", "pictures/hero.webp");
    expect(second).not.toBe(first);
    await store.remove("fan-test");
    expect(revoked).toHaveBeenCalledWith(second);
  });

  it("shares one createObjectURL between concurrent objectUrl calls", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/one");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const { manifest, contents } = buildPack();
    await store.install(manifest, filesOf(contents));
    const urls = await Promise.all([1, 2, 3].map(() => store.objectUrl("fan-test", "pictures/hero.webp")));
    expect(urls).toEqual(["blob:test/one", "blob:test/one", "blob:test/one"]);
    expect(created).toHaveBeenCalledTimes(1);
  });

  it("drops a URL whose pack was removed while the read was in flight", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/stale");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const { manifest, contents } = buildPack();
    await store.install(manifest, filesOf(contents));
    const inFlight = store.objectUrl("fan-test", "pictures/hero.webp");
    store.revoke("fan-test");
    expect(await inFlight).toBeUndefined();
    expect(created).not.toHaveBeenCalled();
  });

  it("installs, lists, reads and removes a pack with its files", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const { manifest, contents } = buildPack();
    expect(await store.list()).toEqual([]);
    const record = await store.install(manifest, filesOf(contents));
    expect(record).toMatchObject({ id: "fan-test", version: "1.0.0", withdrawn: false });
    expect((await store.list()).map((p) => p.id)).toEqual(["fan-test"]);
    expect((await store.get("fan-test"))?.manifest.name).toBe("Test");
    const blob = await store.fileBlob("fan-test", "pictures/hero.webp");
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(contents["pictures/hero.webp"]);
    expect(await store.fileBlob("fan-test", "nope")).toBeUndefined();
    expect(await store.totalBytes()).toBe(manifest.totalBytes);
    expect(await store.packBytes("fan-test")).toBe(manifest.totalBytes);

    await store.remove("fan-test");
    expect(await store.list()).toEqual([]);
    expect(await store.totalBytes()).toBe(0);
  });

  it("an update replaces the old version's files", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const v1 = buildPack({ version: "1.0.0" });
    await store.install(v1.manifest, filesOf(v1.contents));
    const v2 = buildPack({ version: "1.1.0" });
    await store.install(v2.manifest, new Map([["data/cards.json", v2.contents["data/cards.json"]!]]));
    expect((await store.get("fan-test"))?.version).toBe("1.1.0");
    expect(await store.fileBlob("fan-test", "pictures/hero.webp")).toBeUndefined();
    expect(await store.totalBytes()).toBe(v2.contents["data/cards.json"]!.byteLength);
  });

  it("keeps two packs apart", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const a = buildPack({ id: "fan-a" });
    const b = buildPack({ id: "fan-b" });
    await store.install(a.manifest, filesOf(a.contents));
    await store.install(b.manifest, filesOf(b.contents));
    await store.remove("fan-a");
    expect((await store.list()).map((p) => p.id)).toEqual(["fan-b"]);
    expect(await store.fileBlob("fan-b", "data/cards.json")).toBeDefined();
  });

  it("marks a pack withdrawn and back", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const { manifest, contents } = buildPack();
    await store.install(manifest, filesOf(contents));
    await store.markWithdrawn("fan-test", true);
    expect((await store.get("fan-test"))?.withdrawn).toBe(true);
    await store.markWithdrawn("fan-test", false);
    expect((await store.get("fan-test"))?.withdrawn).toBe(false);
    await store.markWithdrawn("missing", true);
  });

  it("hands out one cached blob URL per file and revokes it", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:test/${Math.random()}`);
    const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const { manifest, contents } = buildPack();
    await store.install(manifest, filesOf(contents));
    const first = await store.objectUrl("fan-test", "pictures/hero.webp");
    expect(await store.objectUrl("fan-test", "pictures/hero.webp")).toBe(first);
    expect(created).toHaveBeenCalledTimes(1);
    expect(await store.objectUrl("fan-test", "nope")).toBeUndefined();
    store.revoke("fan-test", "pictures/hero.webp");
    expect(revoked).toHaveBeenCalledWith(first);
  });

  it("asks for persistent storage once, guarded", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", { storage: { persist } });
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const a = buildPack({ id: "fan-a" });
    const b = buildPack({ id: "fan-b" });
    await store.install(a.manifest, filesOf(a.contents));
    await store.install(b.manifest, filesOf(b.contents));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("rejects a bad file value before touching the database", async () => {
    const store = new IdbPackStore({ factory: new IDBFactory() });
    const { manifest } = buildPack();
    await expect(store.install(manifest, new Map([["a", 5 as unknown as Uint8Array]]))).rejects.toThrow();
    expect(await store.list()).toEqual([]);
  });

  it("builds file keys as id@version/path", () => {
    expect(packFileKey("fan-x", "1.0.0", "data/cards.json")).toBe("fan-x@1.0.0/data/cards.json");
  });
});
