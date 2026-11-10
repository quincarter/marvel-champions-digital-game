/**
 * The Briefing's modes for one issue (RRG 1.8 "Campaign Mode", p. 29; issue #611): chosen for this issue, carried by its
 * attempt, kept while the issue is composed again, gone once its game is folded.
 */
import { describe, expect, test } from "vitest";
import type { CampaignChoiceAnswer } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage, type CampaignRecord } from "../engine/campaign-storage.js";
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

async function compose(campaigns: CampaignService, record: CampaignRecord): Promise<CampaignRecord> {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 48; guard++) {
    const result = await campaigns.compose(record, answers);
    if (result.kind === "done") return result.record;
    const choice = result.choice;
    answers.push({
      instructionId: choice.instructionId,
      slot: choice.slot,
      seatNumber: choice.seatNumber,
      picked: choice.options.slice(0, choice.count),
    });
  }
  throw new Error("composing asked more than 48 questions");
}

const composedIssue = async (campaigns: CampaignService) => compose(campaigns, await seedAoaRun(campaigns, "fresh"));

describe("the modes of one campaign issue", () => {
  test("a fresh issue is standard mode, and the campaign's own modes stay as they were", async () => {
    const campaigns = service();
    const record = await composedIssue(campaigns);
    expect(record.issueModes).toBeUndefined();
    expect(record.attempt?.modes.expert).toBeUndefined();
    expect(campaigns.launchConfig(record).difficulty).toBe("standard");
  });

  test("setting them composes the issue under them, and the game is built with them", async () => {
    const campaigns = service();
    const record = await composedIssue(campaigns);
    const before = record.modes;
    const set = await campaigns.setIssueModes(record, { expert: true, heroic: 2 });
    expect(set.attempt).toBeUndefined();
    const composed = await compose(campaigns, set);
    expect(composed.attempt?.modes).toMatchObject({ expert: true, heroic: 2 });
    expect(composed.modes).toEqual(before);
    const config = campaigns.launchConfig(composed);
    expect(config.difficulty).toBe("expert");
    expect(config.modes).toMatchObject({ expert: true, heroic: 2 });
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const { snapshot } = await core.start(config);
    expect(snapshot.state.scenarioRules.heroicLevel).toBe(2);
    expect(snapshot.state.scenarioRules.difficulty).toBe("expert");
  });

  test("they ride through a discarded attempt", async () => {
    const campaigns = service();
    const set = await compose(campaigns, await campaigns.setIssueModes(await composedIssue(campaigns), { heroic: 1 }));
    const discarded = await campaigns.discardAttempt(set);
    expect(discarded.issueModes).toEqual({ heroic: 1 });
    expect((await compose(campaigns, discarded)).attempt?.modes).toMatchObject({ heroic: 1 });
  });

  test("clearing them leaves nothing stored", async () => {
    const campaigns = service();
    const set = await campaigns.setIssueModes(await composedIssue(campaigns), { heroic: 1 });
    expect((await campaigns.setIssueModes(set, {})).issueModes).toBeUndefined();
  });

  test("folding the game drops them, so the next attempt starts from standard", async () => {
    const campaigns = service();
    const composed = await compose(
      campaigns,
      await campaigns.setIssueModes(await composedIssue(campaigns), { expert: true, heroic: 1 }),
    );
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(campaigns.launchConfig(composed));
    const conceded = core.dispatch({ type: "concede", playerId: started.snapshot.state.firstPlayerId });
    if (!conceded.ok) throw new Error(conceded.error.message);
    const folded = await campaigns.fold(composed, core.save(), []);
    if (folded.kind !== "done") throw new Error("a concession asks nothing");
    expect(folded.record.issueModes).toBeUndefined();
    const next = await compose(campaigns, folded.record);
    expect(next.attempt?.modes.heroic).toBeUndefined();
    expect(next.attempt?.modes.expert).toBeUndefined();
  });
});
