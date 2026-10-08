/**
 * Age of Apocalypse (MC45) from the client's own side: a signed run launched through the host path starts a real
 * game (the node's scenario, the composed sets, the set-aside mission, Overseer and Mission Team put into the mission
 * area by the in-game instruction), and the dev seeds leave the log where they say.
 */
import { describe, expect, test } from "vitest";
import { AOA_MISSIONS, AOA_OVERSEERS } from "@mc/cards";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { CampaignService } from "./campaign-service.js";
import { seedAoaRun } from "./dev-fixtures.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

const optionOf = (value: unknown): string =>
  value && typeof value === "object" && "option" in value ? String((value as { option: string }).option) : "";

describe("an Age of Apocalypse game started from the campaign", () => {
  test("is the first scenario with the drawn mission, Overseer and Mission Team in play, and the campaign input as its baseline", async () => {
    const campaigns = service();
    const signed = await seedAoaRun(campaigns, "fresh");
    const composed = await campaigns.compose(signed);
    if (composed.kind !== "done") throw new Error("issue #1 asks nothing on standard");
    const config = campaigns.launchConfig(composed.record);
    expect(config.scenarioId).toBe("unus");
    expect(config.campaign?.nodeId).toBe("unus");
    expect(config.campaignEncounterSets?.deck).toContain("age_of_apocalypse");
    // The campaign's own sets travel in the game input, never as standalone modular picks.
    expect(config.modularSetIds ?? []).not.toContain("aoa_mission");
    expect(config.campaign?.scenarioRuleSpecs?.length).toBeGreaterThan(0);

    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const { snapshot } = await core.start(config);
    const names = Object.values(snapshot.state.instances).map((i) => CARDS_BY_ID.get(i.cardId as string)?.name);
    const mission = optionOf(composed.record.shared.currentMission);
    const overseer = optionOf(composed.record.shared.currentOverseer);
    expect(AOA_MISSIONS.map((row) => row.name)).toContain(mission);
    expect(AOA_OVERSEERS.map((row) => row.name)).toContain(overseer);
    expect(names).toContain("Mission Team");
    expect(names).toContain(mission);
    expect(names).toContain(overseer);
    expect(names).toContain("Unus");
  });

  test("a lost game's retry is composed again with a fresh draw on some seed, and its log still holds the lost attempt", async () => {
    const campaigns = service();
    const lost = await seedAoaRun(campaigns, "lostIssue1");
    expect(lost.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual(["unus:lost"]);
    expect(lost.position.nextNodeId).toBe("unus");
    const again = await campaigns.compose(lost);
    if (again.kind !== "done") throw new Error("the retry asks nothing on standard");
    expect(again.record.attempt?.nodeId).toBe("unus");
  });
});

describe("seedAoaRun", () => {
  test("afterIssue2 leaves two missions struck and scenario 3 next; defeated results are recorded", async () => {
    const record = await seedAoaRun(service(), "afterIssue2");
    expect(record.position.nextNodeId).toBe("apocalypse");
    const struck = record.shared.missions;
    expect(struck?.kind === "strikeList" ? struck.struck : []).toHaveLength(2);
    const results = AOA_MISSIONS.map((row) => optionOf(record.shared[row.resultField])).filter((option) => option);
    expect(results).toHaveLength(2);
    expect(results.every((option) => option === "defeated")).toBe(true);
  });

  test("a win with the missions not defeated records the penalties instead", async () => {
    const record = await seedAoaRun(service(), "afterIssue1", { missionsDefeated: false });
    const results = AOA_MISSIONS.map((row) => optionOf(record.shared[row.resultField])).filter((option) => option);
    expect(results).toEqual(["notDefeated"]);
  });

  test("finished wins the campaign when Protect the Professor is defeated, and loses it when it is not", async () => {
    expect((await seedAoaRun(service(), "finished")).status).toBe("won");
    expect((await seedAoaRun(service(), "finished", { missionsDefeated: false })).status).toBe("lost");
  });
});
