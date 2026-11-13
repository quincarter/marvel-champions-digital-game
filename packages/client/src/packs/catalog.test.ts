import { describe, expect, it } from "vitest";
import { CATALOG_CACHE_KEY, cachedCatalog, loadCatalog, parseCatalog } from "./catalog.js";
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
});
