import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PackManifest } from "@mc/content";
import type { InstanceId } from "@mc/engine";
// Node only, and only here: the client itself never imports the SDK's build.
import { buildPack } from "@mc/mod-sdk/build";
import { gameDeps, setGamePacks } from "../content/game-deps.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { actionAbilityCost } from "../view/cost-choice-model.js";
import { loadActivePacks } from "./active-packs.js";
import { withLoadedPacks } from "./game-packs.js";
import { loadedPacks, setLoadedPacks } from "./pack-registry.js";
import { seatsWithPackDecks, withRequiredPacks, type PackRuntime } from "./pack-runtime.js";
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
  outDir = mkdtempSync(join(tmpdir(), "mc-client-game-pack-"));
  await buildPack(SAMPLE_DIR, outDir);
  manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (!["pack.json", "preview.json", "thumb.webp"].includes(path) && !path.endsWith(".zip"))
      files.set(path, new Uint8Array(readFileSync(full)));
  }
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));
beforeEach(() => {
  setLoadedPacks([]);
  setGamePacks(undefined);
});

const newStore = () => new IdbPackStore({ factory: new IDBFactory() });

const CONFIG = {
  scenarioId: "rhino",
  difficulty: "standard" as const,
  players: [{ starterDeckId: "sample-hero-justice" }],
  seed: 11,
};

async function installed(): Promise<void> {
  const store = newStore();
  await store.install(manifest, files);
  await loadActivePacks(store);
}

/** Keeps the opening hand, so the game is at the first turn. */
async function keepHand(host: LocalEngineHost, playerId: never) {
  const first = await host.legalActions(playerId);
  if (first.kind !== "choice") throw new Error(`expected the opening mulligan, got ${first.kind}`);
  const kept = await host.dispatch({
    type: "resolveChoice",
    playerId: first.choice.playerId,
    choiceId: first.choice.choiceId,
    selectedOptionIds: [],
  });
  if (!kept.ok) throw new Error(kept.error.message);
  return kept.update;
}

describe("a pack game on the main-thread path", () => {
  it("builds a pack ability's cost from the game's own packs, not the static pool or what is installed now", async () => {
    await installed();
    const host = new LocalEngineHost();
    const update = await host.start(CONFIG);
    const kept = await keepHand(host, update.state.players[0]!.playerId as never);
    const costed = Object.entries(loadedPacks()[0]!.abilities).find(([, definition]) => definition.cost !== undefined);
    expect(costed, "the sample pack has an ability with a cost").toBeDefined();
    const action = {
      kind: "useAbility" as const,
      instanceId: kept.state.players[0]!.identity.instanceId as InstanceId,
      abilityId: costed![0] as never,
    };
    const playerId = kept.state.players[0]!.playerId;
    // The static pool has never heard of the ability: no cost.
    expect(actionAbilityCost(kept.state, gameDeps(), playerId, action)).toBeUndefined();
    // The game's own packs (`EngineUpdate.config`, which `SessionStore` hands the screens) carry it, packs unloaded or not.
    setLoadedPacks([]);
    setGamePacks(kept.config?.packs);
    expect(actionAbilityCost(kept.state, gameDeps(), playerId, action)).toBeDefined();
  });

  it("resumes and rewinds a pack game with no packs loaded, from the packs it was saved with", async () => {
    await installed();
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const update = await host.start(CONFIG);
    const kept = await keepHand(host, update.state.players[0]!.playerId as never);
    const [meta] = await storage.list();
    expect(meta!.config.packs?.map((p) => p.id)).toEqual([PACK_ID]);

    setLoadedPacks([]);
    const again = new LocalEngineHost(storage);
    const resumed = await again.resume(meta!.id);
    expect(resumed.version).toBe(kept.version);
    expect(resumed.config?.packs?.map((p) => p.id)).toEqual([PACK_ID]);
    const rewound = await again.rewindTo(0);
    expect(rewound.version).toBe(0);
    expect(rewound.config?.packs?.map((p) => p.id)).toEqual([PACK_ID]);
  });

  it("stores no packs key for a base-game game, even with a pack loaded", async () => {
    await installed();
    const storage = new MemoryGameStorage();
    await new LocalEngineHost(storage).start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 3,
    });
    const [meta] = await storage.list();
    expect(Object.hasOwn(meta!.config, "packs")).toBe(false);
  });

  it("re-attaches packs from what is loaded on every new start, dropping a stale copy", async () => {
    await installed();
    const stale = { ...CONFIG, packs: [{ ...loadedPacks()[0]!, version: "0.0.0-stale" }] };
    expect(withLoadedPacks(stale).packs?.[0]?.version).toBe(loadedPacks()[0]!.version);
    setLoadedPacks([]);
    expect(Object.hasOwn(withLoadedPacks(stale), "packs")).toBe(false);
  });
});

const runtime = (id: string, over: Partial<PackRuntime> = {}): PackRuntime => ({
  id,
  version: "1.0.0",
  name: id,
  requires: [],
  cards: [],
  abilities: {},
  decks: [],
  ...over,
});

const deckOf = (id: string) => ({ id, identityCardId: "x.p.01a", aspects: [], cards: [], provenance: {} }) as never;

describe("pack requirements and decks", () => {
  it("attaches the packs a used pack requires, transitively, in load order", () => {
    const base = runtime("base-pack");
    const mid = runtime("mid-pack", { requires: ["base-pack"] });
    const top = runtime("top-pack", { requires: ["mid-pack"] });
    const other = runtime("other-pack");
    expect(withRequiredPacks([top], [base, mid, top, other]).map((p) => p.id)).toEqual([
      "base-pack",
      "mid-pack",
      "top-pack",
    ]);
  });

  it("never lets a pack deck shadow a base starter deck id", () => {
    const pack = runtime("shadow-pack", { decks: [deckOf("core-spider-man-justice")] });
    const seats = [{ starterDeckId: "core-spider-man-justice" }];
    expect(seatsWithPackDecks(seats, [pack], new Set(["core-spider-man-justice"]))).toEqual(seats);
  });

  it("drops a pack deck that takes a base deck id, and refuses a deck id another pack already has", async () => {
    const store = newStore();
    await store.install({ ...manifest, id: "one-pack" }, files);
    await store.install({ ...manifest, id: "two-pack" }, files);
    const loader = async (m: PackManifest) => ({
      ok: true as const,
      runtime:
        m.id === "one-pack"
          ? runtime("one-pack", { decks: [deckOf("shared-deck"), deckOf("core-spider-man-justice")] })
          : runtime("two-pack", { decks: [deckOf("shared-deck")] }),
    });
    const statuses = await loadActivePacks(store, loader);
    const first = statuses.find((s) => s.id === "one-pack");
    expect(first?.loaded).toBe(true);
    expect(first?.notes?.[0]).toMatch(/core-spider-man-justice/);
    expect(loadedPacks()[0]!.decks.map((d) => d.id)).toEqual(["shared-deck"]);
    const second = statuses.find((s) => s.id === "two-pack");
    expect(second).toMatchObject({ loaded: false });
    expect(second?.reason).toMatch(/shared-deck.*one-pack/);
  });
});
