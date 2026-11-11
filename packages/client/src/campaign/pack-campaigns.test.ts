/**
 * A pack's campaign in the client (docs/custom-content-packs.md §11.10), end to end with the built sample pack: it is
 * listed under Custom campaigns, signed with a base precon through the app's own campaign service, node 1 (a pack scenario)
 * is composed, launched with its pack and folded, its log writes land and node 2 starts; then the pack is removed and
 * the run goes on from the definition it kept.
 */
import "fake-indexeddb/auto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { IDBFactory } from "fake-indexeddb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PackManifest } from "@mc/content";
import type { CampaignRecord } from "../engine/campaign-storage.js";
import type { GameState } from "@mc/engine";
import { buildPack } from "@mc/mod-sdk/build";
import { POOL_VERSION } from "../content/pool.js";
import { setGamePacks } from "../content/game-deps.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { loadActivePacks } from "../packs/active-packs.js";
import { withLoadedPacks } from "../packs/game-packs.js";
import { loadedPacks, setLoadedPacks } from "../packs/pack-registry.js";
import { IdbPackStore } from "../packs/pack-store.js";
import { campaignService } from "../session.js";
import { campaignSagaRows } from "../view/campaign-saga-model.js";
import { basePreconDecks } from "../view/campaign-roster-model.js";
import { SAGA_VOLUMES, storyFor } from "./story.js";
import { campaignRecordOf, customSagaVolumes, embeddedDefinitionOf, packCampaignEntries } from "./pack-campaigns.js";
import { progressOf } from "../progression/unlocks.js";
import { extrasProgressOf } from "../progression/extras.js";
import { factsOf } from "../progression/achievements.js";

const SAMPLE_DIR = fileURLToPath(new URL("../../../../content-packs/sample-scenario", import.meta.url));
const CAMPAIGN_ID = "sample-scenario-crisis";

let outDir = "";
let manifest: PackManifest;
const files = new Map<string, Uint8Array>();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "mc-client-campaign-pack-"));
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

const ROSTER = [basePreconDecks(POOL_VERSION).find((deck) => (deck.id as string).includes("spider-man"))!].map(
  (deck) => ({ identityCardId: deck.identityCardId, deck }),
);

/** A real game state of the launched node, with only the verdict set to a win (the same substitution `campaign-service.test.ts` makes). */
async function wonNode(record: CampaignRecord): Promise<{ state: GameState; packs: readonly string[] }> {
  const config = withLoadedPacks(campaignService().launchConfig(record));
  const started = await new EngineSessionCore({ storage: new MemoryGameStorage() }).start(config);
  setGamePacks(config.packs);
  return {
    state: {
      ...started.snapshot.state,
      cardPool: started.cardPool,
      outcome: { result: "win", reason: "villainDefeated" },
    },
    packs: (config.packs ?? []).map((pack) => pack.id),
  };
}

describe("a pack campaign on the client", () => {
  it("loads the campaign into the pack runtime, from a scenario pack", async () => {
    await installed();
    const [pack] = loadedPacks();
    expect(pack?.campaigns?.map((campaign) => campaign.id)).toEqual([CAMPAIGN_ID]);
    expect(packCampaignEntries(loadedPacks()).map((entry) => entry.pack.name)).toEqual(["The Clockmaker"]);
    expect(campaignRecordOf(CAMPAIGN_ID)).toMatchObject({ name: "Clockwork Crisis", boxCode: "" });
    expect(storyFor(CAMPAIGN_ID)?.issues.map((issue) => issue.title)).toEqual(["Ticking Away", "Rhino on the Street"]);
  });

  it("lists it under Custom campaigns after the base volumes, open whatever the base game has unlocked", async () => {
    await installed();
    const customVolumes = customSagaVolumes(loadedPacks(), []);
    const rows = campaignSagaRows([], { customVolumes, waveLockOf: () => "locked" });
    const custom = rows.at(-1)!;
    expect(custom.volume).toMatchObject({ campaignId: CAMPAIGN_ID, custom: { packId: "sample-scenario" } });
    expect(custom.volume.number).toBeGreaterThan(SAGA_VOLUMES.length);
    expect(custom).toMatchObject({ status: "fresh", unlocked: true, hasDefinition: true, totalIssues: 2 });
    // The base volumes are exactly what they were without it.
    expect(rows.slice(0, SAGA_VOLUMES.length)).toEqual(campaignSagaRows([], { waveLockOf: () => "locked" }));
  });

  it("plays node 1 to a win, writes the log, starts node 2, and carries on after the pack is removed", async () => {
    await installed();
    const service = campaignService();
    const signed = await service.start({ campaignId: CAMPAIGN_ID, seats: ROSTER, poolVersion: POOL_VERSION, seed: 7 });
    expect(signed).toMatchObject({ name: "Clockwork Crisis", box: "", pack: { id: "sample-scenario" } });
    expect(embeddedDefinitionOf(signed.pack!, CAMPAIGN_ID)?.campaignId).toBe(CAMPAIGN_ID);
    expect(signed.pack?.packs.map((pack) => pack.id)).toEqual(["sample-scenario"]);

    // Node 1: a pack scenario, so its game carries the pack.
    const first = await service.compose(signed);
    if (first.kind !== "done") throw new Error("node 1 asks nothing");
    expect(service.launchConfig(first.record).scenarioId).toBe("sample-scenario-clockwork");
    const one = await wonNode(first.record);
    expect(one.packs).toEqual(["sample-scenario"]);
    const afterOne = await service.foldState(first.record, one.state, []);
    if (afterOne.kind !== "done") throw new Error("node 1's victory asks nothing");
    expect(afterOne.record.position.nextNodeId).toBe("street-fight");
    expect(afterOne.record.pack).toEqual(signed.pack);
    expect(afterOne.record.shared).toEqual({
      cogs: { kind: "number", value: 1 },
      stopped: { kind: "flag", value: true },
    });

    // Node 2: a base scenario, but the campaign's pack still rides with the game (and so with its save).
    const second = await service.compose(afterOne.record);
    if (second.kind !== "done") throw new Error("node 2 asks nothing");
    expect(service.launchConfig(second.record).scenarioId).toBe("rhino");
    const two = await wonNode(second.record);
    expect(two.packs).toEqual(["sample-scenario"]);

    // The pack is removed: the run reads the definition it kept, and finishes.
    setLoadedPacks([]);
    setGamePacks(undefined);
    const stored = (await service.load(afterOne.record.id))!;
    expect(service.definitionFor(stored)).toBe(embeddedDefinitionOf(stored.pack!, CAMPAIGN_ID));
    expect(() => service.definitionFor({ campaignId: stored.campaignId })).toThrow(/no campaign definition/);
    expect(campaignRecordOf(CAMPAIGN_ID, stored)).toMatchObject({ name: "Clockwork Crisis" });
    // Its shelf entry survives too, named from the run.
    const summaries = await service.storage.list();
    const orphan = customSagaVolumes([], summaries).find((custom) => custom.volume.campaignId === CAMPAIGN_ID)!;
    const shelf = campaignSagaRows(summaries, { customVolumes: [orphan] }).at(-1)!;
    expect(shelf).toMatchObject({ status: "live", hasDefinition: true, canResume: true, issueNumber: 2 });
    expect(orphan.volume.custom).toEqual({ packId: "sample-scenario", packName: "The Clockmaker" });
    expect(shelf.packNote).toMatch(/not installed/);

    const finished = await service.foldState(second.record, two.state, []);
    if (finished.kind !== "done") throw new Error("node 2's victory asks nothing");
    expect(finished.record.status).toBe("won");
    expect(finished.record.shared.cogs).toEqual({ kind: "number", value: 2 });
  });

  it("plays node 1, a pack scenario, from the pack content embedded in the run after the pack is removed", async () => {
    await installed();
    const service = campaignService();
    const signed = await service.start({ campaignId: CAMPAIGN_ID, seats: ROSTER, poolVersion: POOL_VERSION, seed: 8 });
    setLoadedPacks([]);
    setGamePacks(undefined);

    const first = await service.compose((await service.load(signed.id))!);
    if (first.kind !== "done") throw new Error("node 1 asks nothing");
    const config = withLoadedPacks(service.launchConfig(first.record));
    // The run's own packs ride with the game, though nothing is installed.
    expect(config.packs?.map((pack) => pack.id)).toEqual(["sample-scenario"]);
    expect(config.scenarioId).toBe("sample-scenario-clockwork");
    const one = await wonNode(first.record);
    expect(one.packs).toEqual(["sample-scenario"]);
    const afterOne = await service.foldState(first.record, one.state, []);
    if (afterOne.kind !== "done") throw new Error("node 1's victory asks nothing");
    expect(afterOne.record.position.nextNodeId).toBe("street-fight");
  });

  it("keeps a run on the pack version it was signed with when the pack is updated", async () => {
    await installed();
    const service = campaignService();
    const signed = await service.start({ campaignId: CAMPAIGN_ID, seats: ROSTER, poolVersion: POOL_VERSION, seed: 9 });
    // A modified version 2 of the pack: node 1 now records 5 spare cogs.
    const [v1] = loadedPacks();
    const [campaign] = v1!.campaigns!;
    const modified = JSON.parse(JSON.stringify(campaign).replace('"value":1}', '"value":5}')) as typeof campaign;
    expect(JSON.stringify(modified)).not.toBe(JSON.stringify(campaign));
    setLoadedPacks([{ ...v1!, version: "2.0.0", campaigns: [modified!] }]);

    const first = await service.compose(signed);
    if (first.kind !== "done") throw new Error("node 1 asks nothing");
    const config = withLoadedPacks(service.launchConfig(first.record));
    expect(config.packs?.map((pack) => pack.version)).toEqual(["1.0.0"]);
    const one = await wonNode(first.record);
    const afterOne = await service.foldState(first.record, one.state, []);
    if (afterOne.kind !== "done") throw new Error("node 1's victory asks nothing");
    expect(afterOne.record.shared.cogs).toEqual({ kind: "number", value: 1 });
    expect(afterOne.record.pack?.version).toBe("1.0.0");
    // The shelf says which version the run plays.
    const summaries = await service.storage.list();
    const volumes = customSagaVolumes(loadedPacks(), summaries);
    const row = campaignSagaRows(summaries, { customVolumes: volumes }).at(-1)!;
    expect(row.packNote).toBe("This run plays pack version 1.0.0; version 2.0.0 is installed.");
    // A new run signs the installed version.
    const fresh = await service.start({ campaignId: CAMPAIGN_ID, seats: ROSTER, poolVersion: POOL_VERSION, seed: 10 });
    expect(fresh.pack?.version).toBe("2.0.0");
  });

  it("earns no base progression from a pack's games or campaign runs", async () => {
    const config = { scenarioId: "sample-scenario-clockwork", difficulty: "standard", players: [], packs: [{}] };
    const saves = [
      { status: "won", config },
      { status: "won", config: { scenarioId: "rhino", difficulty: "standard", players: [], packs: [{}] } },
      { status: "won", config: { scenarioId: "klaw", difficulty: "standard", players: [] } },
    ];
    const runs = [
      {
        status: "won",
        campaignId: CAMPAIGN_ID,
        pack: { id: "sample-scenario" },
        position: { nextNodeId: null, resolved: {} },
      },
      { status: "won", campaignId: "trors", position: { nextNodeId: null, resolved: {} } },
    ];
    expect(progressOf(saves as never, runs)).toMatchObject({ wonScenarioIds: ["klaw"], wonCampaignIds: ["trors"] });
    expect(extrasProgressOf(saves as never, runs)).toMatchObject({
      wonScenarioIds: ["klaw"],
      wonCampaignIds: ["trors"],
      startedCampaignIds: ["trors"],
    });
    const facts = factsOf({ saves: saves as never, campaigns: runs });
    expect(facts.wins).toBe(1);
    expect([...facts.wonCampaigns]).toEqual(["trors"]);
  });

  it("leaves a base-game box alone: no pack on its run, no pack on its game", async () => {
    await installed();
    const signed = await campaignService().start({
      campaignId: "trors",
      seats: ROSTER,
      poolVersion: POOL_VERSION,
      seed: 3,
    });
    expect(signed).not.toHaveProperty("pack");
    const composed = await campaignService().compose(signed);
    if (composed.kind !== "done") throw new Error("issue #1 asks nothing");
    expect(withLoadedPacks(campaignService().launchConfig(composed.record))).not.toHaveProperty("packs");
  });
});
