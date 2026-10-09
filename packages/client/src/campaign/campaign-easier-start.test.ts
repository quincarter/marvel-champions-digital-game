/**
 * Apocalypse's easier start as a Briefing toggle in the Age of Apocalypse campaign (owner decision, docs/phase7-wave8.md
 * section 4.1 row 85): off by default, offered on issue #3 in standard mode only, remembered for that attempt, passed to
 * the game the campaign launches, and off again on a retry.
 */
import { describe, expect, test } from "vitest";
import { villainStage, type CampaignChoiceAnswer } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage, type CampaignRecord } from "../engine/campaign-storage.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { easierStartBriefingOf, easierStartIsOn } from "../view/campaign-easier-start-model.js";
import { campaignLaunchConfig } from "../view/campaign-step-model.js";
import { CampaignService } from "./campaign-service.js";
import { seedAoaRun } from "./dev-fixtures.js";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

/** Composes the next issue, answering anything it asks with the first options. */
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

const configOf = (campaigns: CampaignService, record: CampaignRecord) =>
  campaignLaunchConfig(campaigns.definitionFor(record), record);

async function apocalypseStageOf(campaigns: CampaignService, record: CampaignRecord): Promise<number> {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const { snapshot, cardPool } = await core.start(campaigns.launchConfig(record));
  return villainStage({ ...snapshot.state, cardPool }).stageNumber;
}

describe("the easier start toggle on the Briefing", () => {
  test("issue #1 (Unus) does not offer it, and refuses it", async () => {
    const campaigns = service();
    const composed = await compose(campaigns, await seedAoaRun(campaigns, "fresh"));
    expect(composed.attempt?.nodeId).toBe("unus");
    expect(easierStartBriefingOf(composed, configOf(campaigns, composed))).toBeNull();
    await expect(campaigns.setEasierStart(composed, true)).rejects.toThrow(/does not offer/);
    expect(campaigns.launchConfig(composed).easierStart).toBeUndefined();
  });

  test("issue #3 (Apocalypse) offers it, off by default: the game begins at stage II, as the standard campaign always did", async () => {
    const campaigns = service();
    const composed = await compose(campaigns, await seedAoaRun(campaigns, "afterIssue2"));
    expect(composed.attempt?.nodeId).toBe("apocalypse");
    const offered = easierStartBriefingOf(composed, configOf(campaigns, composed));
    expect(offered).toEqual({
      on: false,
      name: "Easier start: begin at Apocalypse (I)",
      meta: "Off · begins at stage II",
    });
    expect(campaigns.launchConfig(composed).easierStart).toBeUndefined();
    expect(await apocalypseStageOf(campaigns, composed)).toBe(2);
  });

  test("on: stored on the record, passed into the launched game, which begins at stage I; off again clears it", async () => {
    const campaigns = service();
    const composed = await compose(campaigns, await seedAoaRun(campaigns, "afterIssue2"));
    const on = await campaigns.setEasierStart(composed, true);
    expect(easierStartIsOn(on)).toBe(true);
    expect(easierStartBriefingOf(on, configOf(campaigns, on))?.meta).toBe("On · begins at stage I");
    expect(campaigns.launchConfig(on).easierStart).toBe(true);
    expect(await apocalypseStageOf(campaigns, on)).toBe(1);
    // It is stored, so a reload of the Briefing finds it.
    const reloaded = await campaigns.load(on.id);
    expect(reloaded && easierStartIsOn(reloaded)).toBe(true);
    const off = await campaigns.setEasierStart(on, false);
    expect(easierStartIsOn(off)).toBe(false);
    expect(campaigns.launchConfig(off).easierStart).toBeUndefined();
    expect(off.easierStartNodeId).toBeUndefined();
  });

  test("it survives a deck edit's discard and compose, and is only ever on for the node it was set on", async () => {
    const campaigns = service();
    const composed = await compose(campaigns, await seedAoaRun(campaigns, "afterIssue2"));
    const on = await campaigns.setEasierStart(composed, true);
    const discarded = await campaigns.discardAttempt(on);
    expect(discarded.attempt).toBeUndefined();
    expect(discarded.easierStartNodeId).toBe("apocalypse");
    expect(easierStartIsOn(discarded)).toBe(false);
    const again = await compose(campaigns, discarded);
    expect(easierStartIsOn(again)).toBe(true);
    // A stored node that is not the composed one is not "on".
    expect(easierStartIsOn({ ...again, easierStartNodeId: "unus" })).toBe(false);
  });

  test("a retry starts with it off: the lost game's fold drops it", async () => {
    const campaigns = service();
    const composed = await compose(campaigns, await seedAoaRun(campaigns, "afterIssue2"));
    const on = await campaigns.setEasierStart(composed, true);
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(campaigns.launchConfig(on));
    const conceded = core.dispatch({ type: "concede", playerId: started.snapshot.state.firstPlayerId });
    if (!conceded.ok) throw new Error(conceded.error.message);
    const folded = await campaigns.fold(on, core.save(), []);
    if (folded.kind !== "done") throw new Error("a concession asks nothing");
    expect(folded.record.position.nextNodeId).toBe("apocalypse");
    expect(folded.record.easierStartNodeId).toBeUndefined();
    const retry = await compose(campaigns, folded.record);
    expect(retry.attempt?.nodeId).toBe("apocalypse");
    expect(easierStartIsOn(retry)).toBe(false);
    expect(campaigns.launchConfig(retry).easierStart).toBeUndefined();
  });

  test("expert mode does not offer it", async () => {
    const campaigns = service();
    const signed = await seedAoaRun(campaigns, "afterIssue2");
    const composed = await compose(campaigns, signed);
    const expert = { ...configOf(campaigns, composed), difficulty: "expert" as const };
    expect(easierStartBriefingOf(composed, expert)).toBeNull();
  });
});
