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
import {
  CUSTOM_SHELF_ID,
  POOL_SCENARIOS,
  currentCardsById,
  currentEncounterSets,
  currentScenarios,
  isPackEncounterSet,
  isPackScenario,
} from "../content/pool.js";
import { gameCardsById, gameEncounterSetName, gameScenarios, setGamePacks } from "../content/game-deps.js";
import { pauseStatusOf } from "../view/pause-model.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { modularCandidatesFor } from "../view/modular-candidates.js";
import { modularSetOptionsFor } from "../view/modular-sets.js";
import { initialSetupDraft, toSessionConfig, type SetupDraft } from "../view/setup-draft.js";
import { offerOf } from "../view/setup-options.js";
import { withLoadedPacks } from "./game-packs.js";
import { loadActivePacks } from "./active-packs.js";
import { loadedPacks, setLoadedPacks } from "./pack-registry.js";
import { IdbPackStore } from "./pack-store.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../../content-packs/sample-scenario", import.meta.url));
const PACK_ID = "sample-scenario";
const SCENARIO_ID = "sample-scenario-clockwork";
const GEARS = "sample-scenario-gears";

let outDir = "";
let manifest: PackManifest;
const files = new Map<string, Uint8Array>();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-client-scenario-pack-"));
  await buildPack(SAMPLE_DIR, outDir);
  manifest = JSON.parse(readFileSync(join(outDir, "pack.json"), "utf8")) as PackManifest;
  for (const full of walk(outDir)) {
    const path = relative(outDir, full).split(sep).join("/");
    if (path !== "pack.json" && !path.endsWith(".zip")) files.set(path, new Uint8Array(readFileSync(full)));
  }
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));
beforeEach(() => {
  setLoadedPacks([]);
  setGamePacks(undefined);
});

async function installed(): Promise<void> {
  const store = new IdbPackStore({ factory: new IDBFactory() });
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

const PRECON = { starterDeckId: "core-spider-man-justice" };

const draftAt = (scenarioId: string, over: Partial<SetupDraft> = {}): SetupDraft =>
  ({ ...initialSetupDraft({ scenarioId } as never), ...over }) as SetupDraft;

describe("a scenario pack in the pickers", () => {
  it("loads the pack's scenarios and encounter sets, and lists them after the base game's", async () => {
    await installed();
    const [pack] = loadedPacks();
    expect(pack?.scenarios?.map((s) => s.id)).toEqual([SCENARIO_ID]);
    expect(pack?.encounterSets?.map((s) => s.id as string).sort()).toEqual([SCENARIO_ID, GEARS]);
    expect(currentScenarios().slice(0, POOL_SCENARIOS.length)).toEqual(POOL_SCENARIOS);
    expect(currentScenarios().at(-1)?.id).toBe(SCENARIO_ID);
    expect(isPackScenario(SCENARIO_ID)).toBe(true);
    expect(isPackScenario("rhino")).toBe(false);
    expect(isPackEncounterSet(GEARS)).toBe(true);
    expect(currentEncounterSets().find((set) => set.id === GEARS)?.name).toBe("Gears");
    // The villain is in the pool the screens read, so its tile and hover can find its card.
    expect(currentCardsById().get("x.sample-scenario.01")?.type).toBe("villain");
  });

  it("is the base list, untouched, with no pack loaded", () => {
    expect(currentScenarios()).toBe(POOL_SCENARIOS);
    expect(isPackScenario(SCENARIO_ID)).toBe(false);
  });

  it("offers the pack's modular set at a base scenario under Custom packs, badged in words", async () => {
    await installed();
    const rhino = POOL_SCENARIOS.find((s) => s.id === "rhino")!;
    const candidate = modularCandidatesFor(rhino).find((c) => c.id === GEARS);
    expect(candidate).toMatchObject({ groupId: CUSTOM_SHELF_ID, groupLabel: "Custom packs", recommended: false });
    const options = modularSetOptionsFor(draftAt("rhino"), rhino, currentCardsById());
    const option = options.find((o) => o.id === GEARS)!;
    expect(option.name).toBe("Gears");
    expect(option.descriptor?.startsWith("CUSTOM")).toBe(true);
    expect(option.cardCount).toBeGreaterThan(0);
    // A base set carries no badge.
    expect(options.find((o) => o.id === "bomb_scare")?.descriptor?.startsWith("CUSTOM") ?? false).toBe(false);
  });

  it("offers the pack scenario its own set as the recommendation, and no extras or options it would refuse", async () => {
    await installed();
    const scenario = currentScenarios().find((s) => s.id === SCENARIO_ID)!;
    expect(modularCandidatesFor(scenario)[0]).toMatchObject({ id: GEARS, recommended: true });
    const draft = draftAt(SCENARIO_ID);
    expect(modularSetOptionsFor(draft, scenario, currentCardsById()).some((o) => o.kind === "extra")).toBe(false);
    // Skirmish, set alternatives and the easier start are the base scenarios' own: none is offered.
    const offer = offerOf(draft);
    expect(offer.skirmish).toBeNull();
    expect(offer.easierStart).toBe(false);
    expect(offer.difficultySets).toEqual({ standard: [], expert: [] });
  });

  it("offers no pack set where the builder refuses one (a scenario that draws from a modular pool)", async () => {
    await installed();
    const pooled = POOL_SCENARIOS.filter((s) => s.modularSetPool !== undefined);
    expect(pooled.length).toBeGreaterThan(0);
    for (const scenario of pooled) expect(modularCandidatesFor(scenario).some((c) => c.id === GEARS)).toBe(false);
  });
});

describe("a game at a pack scenario or with a pack modular set", () => {
  const configAt = (over: Partial<SetupDraft>) => toSessionConfig(draftAt("rhino", over), [PRECON as never]);

  it("starts the pack's scenario with a base precon through the client's own host and resumes it with no packs loaded", async () => {
    await installed();
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const update = await host.start({ scenarioId: SCENARIO_ID, difficulty: "standard", players: [PRECON], seed: 5 });
    const pool = update.state.cardPool;
    const ids = new Set(Array.isArray(pool) ? pool.map((card) => card.id as string) : Object.keys(pool));
    expect(ids.has("x.sample-scenario.01")).toBe(true);
    const kept = await keepHand(host, update.state.players[0]!.playerId as never);
    const [meta] = await storage.list();
    expect(meta!.config.scenarioId).toBe(SCENARIO_ID);
    expect(meta!.config.packs?.map((p) => p.id)).toEqual([PACK_ID]);

    setLoadedPacks([]);
    const again = new LocalEngineHost(storage);
    const resumed = await again.resume(meta!.id);
    expect(resumed.version).toBe(kept.version);
    expect(resumed.config?.packs?.map((p) => p.id)).toEqual([PACK_ID]);
    const rewound = await again.rewindTo(0);
    expect(rewound.version).toBe(0);
  });

  it("starts a base scenario with the pack's Gears set and carries the pack, so it resumes with none loaded", async () => {
    await installed();
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const start = configAt({ modularSetIds: [GEARS], seed: 9 });
    expect(start.modularSetIds).toEqual([GEARS]);
    const update = await host.start(start);
    const [meta] = await storage.list();
    expect(meta!.config.packs?.map((p) => p.id)).toEqual([PACK_ID]);
    expect(JSON.stringify(update.state)).toContain("x.sample-scenario.");

    setLoadedPacks([]);
    const resumed = await new LocalEngineHost(storage).resume(meta!.id);
    expect(resumed.version).toBe(update.version);
    expect(resumed.config?.modularSetIds).toEqual([GEARS]);
  });

  it("leaves a base game's config and save without a packs key, with the scenario pack installed", async () => {
    await installed();
    expect(Object.hasOwn(withLoadedPacks(configAt({})), "packs")).toBe(false);
    const storage = new MemoryGameStorage();
    await new LocalEngineHost(storage).start(configAt({ seed: 3 }));
    const [meta] = await storage.list();
    expect(Object.hasOwn(meta!.config, "packs")).toBe(false);
    // A base modular pick does not carry the pack either.
    expect(Object.hasOwn(withLoadedPacks(configAt({ modularSetIds: ["bomb_scare"] })), "packs")).toBe(false);
  });

  it("names a pack game's scenario and sets from the game's own packs once nothing is installed", async () => {
    await installed();
    const host = new LocalEngineHost(new MemoryGameStorage());
    const update = await host.start({
      scenarioId: SCENARIO_ID,
      difficulty: "standard",
      players: [PRECON],
      seed: 5,
      modularSetIds: [GEARS],
    });
    setLoadedPacks([]);
    setGamePacks(update.config?.packs);
    const status = pauseStatusOf(
      update.state,
      update.state.players[0]!.playerId,
      update.config ?? null,
      gameScenarios(),
    );
    expect(status.scenarioName).toBe("The Clockmaker");
    expect(gameEncounterSetName(GEARS)).toBe("Gears");
    expect(gameEncounterSetName("rhino")).toBeDefined();
    expect(gameCardsById().get("x.sample-scenario.01")?.name).toBeTruthy();
  });

  it("starts a two-modular base scenario with one base and one pack set, and resumes it with none loaded", async () => {
    await installed();
    const scenario = POOL_SCENARIOS.find(
      (s) =>
        s.modularSetCount === 2 &&
        s.modularSetPool === undefined &&
        s.side === undefined &&
        offerOf(draftAt(s.id as string)).difficultySets.standard.length > 0,
    );
    expect(scenario, "a two-modular scenario with difficulty set alternatives").toBeDefined();
    const id = scenario!.id as string;
    const base = modularCandidatesFor(scenario!).find(
      (c) => !c.disabledReason && c.id !== GEARS && c.groupId !== CUSTOM_SHELF_ID,
    )!;
    const picks = [base.id, GEARS];
    const storage = new MemoryGameStorage();
    const draft = draftAt(id, { modularSetIds: picks, seed: 4 });
    const update = await new LocalEngineHost(storage).start(toSessionConfig(draft, [PRECON as never]));
    const [meta] = await storage.list();
    expect(meta!.config.packs?.map((p) => p.id)).toEqual([PACK_ID]);
    // The offer still lists the base set alternatives with a pack set among the picks.
    expect(offerOf(draft).difficultySets.standard.length).toBeGreaterThan(0);
    setLoadedPacks([]);
    const resumed = await new LocalEngineHost(storage).resume(meta!.id);
    expect(resumed.version).toBe(update.version);
    expect(resumed.config?.modularSetIds).toEqual(picks);
  });
});
