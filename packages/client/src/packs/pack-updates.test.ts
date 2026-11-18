import { afterEach, describe, expect, it, vi } from "vitest";
import type { PackIndex } from "@mc/content";
import {
  badgeTextOf,
  checkPackUpdates,
  CHECK_INTERVAL_MS,
  notePackUpdates,
  onPackUpdateCount,
  packUpdateCount,
  packUpdateCountOf,
  resetPackUpdatesForTest,
} from "./pack-updates.js";
import { buildPack } from "./test-zip.js";
import { CATALOG_CACHE_KEY } from "./catalog.js";
import type { InstalledPack } from "./pack-store.js";

const context = { appVersion: "0.49.0", supportedDslFeatures: [] };

function indexOf(...packs: ReturnType<typeof buildPack>["entry"][]): PackIndex {
  return { schema: 2, generated: "2026-11-18T00:00:00Z", packs };
}

function installed(id: string, version: string, withdrawn = false): InstalledPack {
  const { manifest } = buildPack({ id, version });
  return { id, version, manifest, installedAt: "2026-11-01T00:00:00Z", withdrawn };
}

const store = (packs: readonly InstalledPack[]) => ({ list: async () => [...packs] });
const json = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

afterEach(() => resetPackUpdatesForTest());

describe("packUpdateCountOf", () => {
  it("counts only installed packs with an installable newer version", () => {
    const newer = buildPack({ id: "fan-newer", version: "1.1.0" }).entry;
    const same = buildPack({ id: "fan-same", version: "1.0.0" }).entry;
    const notInstalled = buildPack({ id: "fan-other", version: "2.0.0" }).entry;
    const tooNew = buildPack({ id: "fan-too-new", version: "3.0.0" }).entry;
    const tooNewVersion = tooNew.versions["3.0.0"]!;
    const needsApp = { ...tooNew, versions: { "3.0.0": { ...tooNewVersion, requires: { app: ">=99.0.0" } } } };
    const withdrawn = { ...buildPack({ id: "fan-gone", version: "1.2.0" }).entry, withdrawn: true };
    const index = indexOf(newer, same, notInstalled, needsApp, withdrawn);
    const packs = [
      installed("fan-newer", "1.0.0"),
      installed("fan-same", "1.0.0"),
      installed("fan-too-new", "1.0.0"),
      installed("fan-gone", "1.0.0"),
      installed("fan-orphan", "1.0.0"),
    ];
    expect(packUpdateCountOf(index, packs, context)).toBe(1);
  });

  it("caps the badge at 9+", () => {
    expect(badgeTextOf(1)).toBe("1");
    expect(badgeTextOf(9)).toBe("9");
    expect(badgeTextOf(12)).toBe("9+");
  });
});

describe("checkPackUpdates", () => {
  const index = indexOf(buildPack({ id: "fan-newer", version: "1.1.0" }).entry);

  it("skips the network when nothing is installed", async () => {
    const fetch = json(index);
    expect(await checkPackUpdates({ store: store([]), fetch, storage: null })).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("counts, tells listeners, and reuses a fresh catalog", async () => {
    const fetch = json(index);
    const heard: number[] = [];
    onPackUpdateCount((n) => heard.push(n));
    let now = 1_000;
    const deps = { store: store([installed("fan-newer", "1.0.0")]), fetch, storage: null, now: () => now };
    expect(await checkPackUpdates(deps)).toBe(1);
    expect(packUpdateCount()).toBe(1);
    expect(heard).toEqual([1]);
    await checkPackUpdates(deps);
    expect(fetch).toHaveBeenCalledTimes(1);
    now += CHECK_INTERVAL_MS;
    await checkPackUpdates(deps);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("drops to 0 once the store notes the update", async () => {
    await checkPackUpdates({ store: store([installed("fan-newer", "1.0.0")]), fetch: json(index), storage: null });
    expect(packUpdateCount()).toBe(1);
    notePackUpdates(undefined, [installed("fan-newer", "1.1.0")]);
    expect(packUpdateCount()).toBe(0);
  });

  it("keeps quiet when the catalog cannot be reached and nothing is saved", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await checkPackUpdates({ store: store([installed("fan-newer", "1.0.0")]), fetch, storage: null })).toBe(0);
  });

  it("counts from the saved copy offline, and tries the network again next time", async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => void saved.set(k, v),
    };
    const deps = { store: store([installed("fan-newer", "1.0.0")]), storage };
    await checkPackUpdates({ ...deps, fetch: json(index) });
    resetPackUpdatesForTest();
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await checkPackUpdates({ ...deps, fetch: down })).toBe(1);
    const back = json(index);
    await checkPackUpdates({ ...deps, fetch: back });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("lets a store update made during a slow check stand", async () => {
    let release: (() => void) | undefined;
    const slow = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(new Response(JSON.stringify(index), { status: 200 }));
        }),
    );
    const saved = new Map<string, string>();
    const storage = {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => void saved.set(k, v),
    };
    const check = checkPackUpdates({ store: store([installed("fan-newer", "1.0.0")]), fetch: slow, storage });
    await vi.waitFor(() => expect(release).toBeDefined());
    // The store's catalog is newer than the one the slow check is fetching: it already lists 1.2.0.
    const newer = indexOf(buildPack({ id: "fan-newer", version: "1.2.0" }).entry);
    notePackUpdates(newer, [installed("fan-newer", "1.1.0")]);
    expect(packUpdateCount()).toBe(1);
    release!();
    await check;
    expect(packUpdateCount()).toBe(1);
    // The next check reuses the store's catalog, not the slow check's older one.
    const next = json(index);
    expect(
      await checkPackUpdates({ store: store([installed("fan-newer", "1.1.0")]), fetch: next, storage: null }),
    ).toBe(1);
    expect(next).not.toHaveBeenCalled();
    // Nor does the slow answer replace the saved copy.
    expect(saved.size).toBe(0);
  });

  it("gives up on a catalog request that hangs, counts from the saved copy, and lets the next check retry", async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => void saved.set(k, v),
    };
    const deps = { store: store([installed("fan-newer", "1.0.0")]), storage };
    await checkPackUpdates({ ...deps, fetch: json(index) });
    resetPackUpdatesForTest();
    const hang = vi.fn(() => new Promise<Response>(() => {}));
    expect(await checkPackUpdates({ ...deps, fetch: hang, timeoutMs: 10 })).toBe(1);
    const back = json(index);
    await checkPackUpdates({ ...deps, fetch: back });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("does not treat the store's offline copy as fresh", async () => {
    const deps = { store: store([installed("fan-newer", "1.0.0")]), storage: null };
    await checkPackUpdates({ ...deps, fetch: json(index) });
    notePackUpdates(index, [installed("fan-newer", "1.0.0")], true);
    const back = json(index);
    await checkPackUpdates({ ...deps, fetch: back });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("never replaces a newer saved catalog with an older answer", async () => {
    const newer = {
      ...indexOf(buildPack({ id: "fan-newer", version: "1.2.0" }).entry),
      generated: "2026-11-19T00:00:00Z",
    };
    const saved = new Map<string, string>([[CATALOG_CACHE_KEY, JSON.stringify(newer)]]);
    const storage = {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => void saved.set(k, v),
    };
    // Installed at 1.1.0: the older answer (1.1.0) has no update for it, the saved catalog (1.2.0) does.
    const deps = { store: store([installed("fan-newer", "1.1.0")]), storage };
    expect(await checkPackUpdates({ ...deps, fetch: json(index) })).toBe(1);
    expect(JSON.parse(saved.get(CATALOG_CACHE_KEY)!).generated).toBe("2026-11-19T00:00:00Z");
    const next = json(index);
    expect(await checkPackUpdates({ ...deps, fetch: next })).toBe(1);
    expect(next).not.toHaveBeenCalled();
  });
});
