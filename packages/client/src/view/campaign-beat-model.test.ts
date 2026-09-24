import { describe, expect, test } from "vitest";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { campaignBeatFor } from "./campaign-beat-model.js";

const CROSSBONES_ID = "04008" as InstanceId;

function stateWith(round: number): GameState {
  return {
    round,
    instances: { [CROSSBONES_ID]: { cardId: "04008" } },
    cardPool: { "04008": { name: "Crossbones" } },
  } as unknown as GameState;
}

const flip = (stageIndex: number): GameEvent =>
  ({ type: "villainStageAdvanced", stageIndex, instanceId: CROSSBONES_ID }) as GameEvent;

const CAMPAIGN_CONFIG = { scenarioId: "crossbones", campaign: { campaignId: "trors", nodeId: "crossbones" } };

describe("campaignBeatFor", () => {
  test("null outside a campaign game", () => {
    expect(campaignBeatFor([flip(1)], stateWith(4), { scenarioId: "crossbones", campaign: null })).toBeNull();
    expect(campaignBeatFor([flip(1)], stateWith(4), null)).toBeNull();
  });

  test("null when the command has no stage flip", () => {
    expect(campaignBeatFor([{ type: "playerEliminated" } as GameEvent], stateWith(4), CAMPAIGN_CONFIG)).toBeNull();
  });

  test("null when the story has no line for that stage", () => {
    // The Rise of Red Skull's Crossbones only has lines for stages 2 and 3; stage 4 doesn't exist in the story.
    expect(campaignBeatFor([flip(3)], stateWith(4), CAMPAIGN_CONFIG)).toBeNull();
  });

  test("builds the beat for a stage the story does have a line for", () => {
    const beat = campaignBeatFor([flip(1)], stateWith(4), CAMPAIGN_CONFIG);
    expect(beat).toEqual({
      campaignId: "trors",
      nodeId: "crossbones",
      stage: 2,
      round: 4,
      villainName: "Crossbones",
      scenarioId: "crossbones",
    });
  });
});
