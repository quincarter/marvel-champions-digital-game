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
import { campaignRecordOf, customSagaVolumes, packCampaignEntries } from "./pack-campaigns.js";

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
    expect(signed.pack?.definition.campaignId).toBe(CAMPAIGN_ID);

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
    expect(service.definitionFor(stored)).toBe(stored.pack!.definition);
    expect(() => service.definitionFor({ campaignId: stored.campaignId })).toThrow(/no campaign definition/);
    expect(campaignRecordOf(CAMPAIGN_ID, stored)).toMatchObject({ name: "Clockwork Crisis" });
    // Its shelf entry survives too, named from the run.
    const summaries = await service.storage.list();
    const orphan = customSagaVolumes([], summaries).find((custom) => custom.volume.campaignId === CAMPAIGN_ID)!;
    const shelf = campaignSagaRows(summaries, { customVolumes: [orphan] }).at(-1)!;
    expect(shelf).toMatchObject({ status: "live", hasDefinition: true, canResume: true, issueNumber: 2 });

    const finished = await service.foldState(second.record, two.state, []);
    if (finished.kind !== "done") throw new Error("node 2's victory asks nothing");
    expect(finished.record.status).toBe("won");
    expect(finished.record.shared.cogs).toEqual({ kind: "number", value: 2 });
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
