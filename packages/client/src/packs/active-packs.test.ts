import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PackManifest } from "@mc/content";
// Node only, and only here: the client itself never imports the SDK's build.
import { buildPack } from "@mc/mod-sdk/build";
import { POOL_CARDS, POOL_DEPS, currentCardsById, currentDeps, currentPool } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { activePackStatuses, loadActivePacks, refreshActivePacks } from "./active-packs.js";
import { loadInWorker } from "./load-client.js";
import { NO_REQUIRED_CONTENT } from "./pack-load.js";
import { loadedPacks, setLoadedPacks } from "./pack-registry.js";
import { IdbPackStore } from "./pack-store.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../../content-packs/sample-hero", import.meta.url));
const PACK_ID = "sample-hero";

let outDir = "";
let manifest: PackManifest;
const files = new Map<string, Uint8Array>();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-client-pack-"));
  await buildPack(SAMPLE_DIR, outDir);
  manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));
beforeEach(() => setLoadedPacks([]));

const newStore = () => new IdbPackStore({ factory: new IDBFactory() });

describe("active packs", () => {
  it("is the base pool, untouched, with no pack installed", async () => {
    expect(await loadActivePacks(newStore())).toEqual([]);
    expect(currentPool()).toBe(POOL_CARDS);
    expect(currentDeps()).toBe(POOL_DEPS);
  });

  it("merges an installed pack's cards and abilities into the current pool", async () => {
    const store = newStore();
    await store.install(manifest, files);
    const statuses = await refreshActivePacks(store);
    expect(statuses).toMatchObject([{ id: PACK_ID, loaded: true }]);
    expect(activePackStatuses()).toBe(statuses);
    const pack = loadedPacks()[0]!;
    expect(currentPool().length).toBe(POOL_CARDS.length + pack.cards.length);
    expect(currentCardsById().get("x.sample-hero.01a")?.name).toBeTruthy();
    expect(Object.keys(currentDeps().abilities).length).toBe(
      Object.keys(POOL_DEPS.abilities).length + Object.keys(pack.abilities).length,
    );
    for (const id of Object.keys(pack.abilities)) expect(currentDeps().abilities[id]).toBeDefined();
  });

  it("runs the load here when the worker cannot start or fails", async () => {
    const need = NO_REQUIRED_CONTENT;
    const none = await loadInWorker(manifest, files, need, () => null);
    expect(none).toMatchObject({ ok: true });
    const broken = {
      onmessage: null,
      onerror: null as null | ((e: unknown) => void),
      postMessage() {
        this.onerror?.(new Error("boom"));
      },
      terminate() {},
    };
    expect(await loadInWorker(manifest, files, need, () => broken)).toMatchObject({ ok: true });
  });

  it("skips a pack whose requirements are not met, with a reason, and keeps the rest", async () => {
    const store = newStore();
    await store.install(manifest, files);
    const needy: PackManifest = {
      ...manifest,
      id: "needs-feature",
      requires: { ...manifest.requires, dslFeatures: ["no-such-feature"] },
    };
    await store.install(needy, files);
    const statuses = await loadActivePacks(store);
    expect(statuses.find((s) => s.id === PACK_ID)?.loaded).toBe(true);
    const skipped = statuses.find((s) => s.id === "needs-feature");
    expect(skipped).toMatchObject({ loaded: false });
    expect(skipped?.reason).toMatch(/no-such-feature/);
    expect(loadedPacks().map((p) => p.id)).toEqual([PACK_ID]);
  });

  it("skips a pack that fails validation, with the first problems", async () => {
    const store = newStore();
    const bad = new Map(files);
    bad.set(manifest.contents.cards, new TextEncoder().encode("[]"));
    await store.install(manifest, bad);
    const [status] = await loadActivePacks(store);
    expect(status).toMatchObject({ id: PACK_ID, loaded: false });
    expect(status?.reason).toMatch(/Failed validation/);
    expect(loadedPacks()).toEqual([]);
  });

  it("starts a game with the pack's precon through the client's own host, abilities and all", async () => {
    const store = newStore();
    await store.install(manifest, files);
    await loadActivePacks(store);
    const config = {
      scenarioId: "rhino",
      difficulty: "standard" as const,
      players: [{ starterDeckId: "sample-hero-justice" }],
      seed: 7,
    };
    const host = new LocalEngineHost();
    const update = await host.start(config);
    const pool = update.state.cardPool;
    const cardIds = new Set(Array.isArray(pool) ? pool.map((card) => card.id as string) : Object.keys(pool));
    expect(cardIds.has("x.sample-hero.01a")).toBe(true);
    expect(cardIds.has("x.sample-hero.06")).toBe(true);
    // The hero's identity is in play with the pack's own abilities live: the legal list for its owner names them.
    const pack = loadedPacks()[0]!;
    const abilityIds = Object.keys(pack.abilities);
    expect(abilityIds.length).toBeGreaterThan(0);
    const playerId = update.state.players[0]!.playerId;
    const first = await host.legalActions(playerId);
    if (first.kind !== "choice") throw new Error(`expected the opening mulligan, got ${first.kind}`);
    const kept = await host.dispatch({
      type: "resolveChoice",
      playerId: first.choice.playerId,
      choiceId: first.choice.choiceId,
      selectedOptionIds: [],
    });
    if (!kept.ok) throw new Error(kept.error.message);
    const legal = JSON.stringify(kept.update.legal);
    expect(abilityIds.some((id) => legal.includes(id))).toBe(true);

    // A host with no pack loaded cannot even set the precon up: nothing leaks between games.
    setLoadedPacks([]);
    await expect(new LocalEngineHost().start(config)).rejects.toThrow();
  });
});
