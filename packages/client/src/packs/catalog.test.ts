import { describe, expect, it } from "vitest";
import type { PackIndex } from "@mc/content";
import {
  CATALOG_CACHE_KEY,
  cachedCatalog,
  isNewerCatalog,
  loadCatalog,
  onCatalogCached,
  parseCatalog,
} from "./catalog.js";
import { buildPack } from "./test-zip.js";

const index = { schema: 2, generated: "2026-11-10T00:00:00Z", packs: [buildPack().entry] };

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
}

const json =
  (body: unknown, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status });

describe("catalog", () => {
  it("validates the shape and drops malformed entries", () => {
    expect(parseCatalog(index)?.packs).toHaveLength(1);
    expect(parseCatalog({ ...index, packs: [...index.packs, { id: "broken" }] })?.packs).toHaveLength(1);
    expect(parseCatalog({ ...index, schema: 1 })).toBeUndefined();
    expect(parseCatalog({ schema: 2 })).toBeUndefined();
    expect(parseCatalog("nope")).toBeUndefined();
  });

  it("fetches and caches the last good copy", async () => {
    const storage = memoryStorage();
    const result = await loadCatalog({ fetch: json(index), storage, url: "/x/index.json" });
    expect(result.offline).toBe(false);
    expect(result.index.packs[0]?.id).toBe("fan-test");
    expect(storage.map.has(CATALOG_CACHE_KEY)).toBe(true);
    expect(cachedCatalog(storage)?.packs).toHaveLength(1);
  });

  it("tells listeners when a fresh catalog is cached, not when it falls back to the cache", async () => {
    const storage = memoryStorage();
    let calls = 0;
    const stop = onCatalogCached(() => calls++);
    await loadCatalog({ fetch: json(index), storage });
    expect(calls).toBe(1);
    await loadCatalog({ fetch: json(index, 500), storage });
    expect(calls).toBe(1);
    stop();
    await loadCatalog({ fetch: json(index), storage });
    expect(calls).toBe(1);
  });

  it("falls back to the cache when offline or the catalog is bad", async () => {
    const storage = memoryStorage();
    await loadCatalog({ fetch: json(index), storage });
    const offline = await loadCatalog({
      storage,
      fetch: async () => {
        throw new TypeError("offline");
      },
    });
    expect(offline.offline).toBe(true);
    expect(offline.index.packs).toHaveLength(1);
    expect((await loadCatalog({ storage, fetch: json({ junk: true }) })).offline).toBe(true);
    expect((await loadCatalog({ storage, fetch: json(index, 500) })).offline).toBe(true);
  });

  it("throws when offline with no cache", async () => {
    await expect(loadCatalog({ storage: memoryStorage(), fetch: json(index, 404) })).rejects.toThrow();
  });

  it("never replaces a newer saved copy with an older catalog, and returns the newer one", async () => {
    const storage = memoryStorage();
    await loadCatalog({ fetch: json({ ...index, generated: "2026-11-19T00:00:00Z" }), storage });
    const older = await loadCatalog({ fetch: json(index), storage });
    expect(older.index.generated).toBe("2026-11-19T00:00:00Z");
    expect(cachedCatalog(storage)?.generated).toBe("2026-11-19T00:00:00Z");
  });

  it("orders catalogs by parsed time and never lets a bad or future time win", () => {
    const at = (generated: string): PackIndex => ({ ...index, schema: 2, generated });
    const now = Date.parse("2026-11-18T12:00:00Z");
    expect(isNewerCatalog(at("2026-11-18T01:00:00+02:00"), at("2026-11-17T23:30:00.5Z"), now)).toBe(false);
    expect(isNewerCatalog(at("2026-11-18T03:00:00+02:00"), at("2026-11-18T00:30:00Z"), now)).toBe(true);
    expect(isNewerCatalog(at("not a date"), at("2026-11-10T00:00:00Z"), now)).toBe(false);
    expect(isNewerCatalog(at("2026-11-10T00:00:00Z"), at("not a date"), now)).toBe(true);
    expect(isNewerCatalog(at("2099-01-01T00:00:00Z"), at("2026-11-10T00:00:00Z"), now)).toBe(false);
  });

  it("a future-dated saved copy does not pin the store", async () => {
    const storage = memoryStorage();
    storage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ...index, generated: "2099-01-01T00:00:00Z" }));
    const result = await loadCatalog({ fetch: json(index), storage });
    expect(result.index.generated).toBe(index.generated);
    expect(cachedCatalog(storage)?.generated).toBe(index.generated);
  });
});
