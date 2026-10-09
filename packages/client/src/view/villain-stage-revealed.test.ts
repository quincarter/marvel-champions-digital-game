/**
 * Views that react to a villain's stage change also listen for `villainStageRevealed` (docs/phase7-wave8.md §3.18):
 * Apocalypse's stages are revealed by the main scheme and are never `villainStageAdvanced`.
 */
import { describe, expect, test } from "vitest";
import { activeVillain, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { emptyRecord, recordEvents } from "../engine/game-record.js";
import { POOL_DEPS } from "../content/pool.js";
import { defaultGuidePrefs } from "../guide/guide-prefs.js";
import { campaignBeatFor } from "./campaign-beat-model.js";
import { eventRefs } from "./card-history.js";
import { turningPoints } from "./game-over-model.js";
import { tipsFor } from "./guide-tips.js";

const revealed = (instanceId: InstanceId, stageIndex = 1): GameEvent => ({
  type: "villainStageRevealed",
  instanceId,
  stageIndex,
  fromStageNumber: stageIndex,
  toStageNumber: stageIndex + 1,
  cause: "effect",
});

describe("villainStageRevealed in the views", () => {
  test("the campaign beat opens on a revealed stage, as it does on an advanced one", () => {
    const id = "04008" as InstanceId;
    const state = {
      round: 3,
      instances: { [id]: { cardId: "04008" } },
      cardPool: { "04008": { name: "Crossbones" } },
    } as unknown as GameState;
    const config = { scenarioId: "crossbones", campaign: { campaignId: "trors", nodeId: "crossbones" } };
    expect(campaignBeatFor([revealed(id)], state, config)).toEqual(
      campaignBeatFor([{ type: "villainStageAdvanced", stageIndex: 1, instanceId: id }], state, config),
    );
    expect(campaignBeatFor([revealed(id)], state, config)?.stage).toBe(2);
  });

  test("the card history ties the event to the villain card", () => {
    expect(eventRefs(revealed("v1" as InstanceId))).toEqual(["v1"]);
  });

  test("the game record notes the round and the game-over debrief says it moved, not that it was pushed", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 4,
    });
    const game = store.state.game!;
    const villain = activeVillain(game);
    const record = recordEvents(emptyRecord(), [revealed(villain.instanceId)], game);
    expect(record.rounds.some((round) => round.villainStageRevealed === true)).toBe(true);
    expect(record.rounds.every((round) => round.villainStageAdvanced === false)).toBe(true);
    const beats = turningPoints(game, record, "win", "Apocalypse");
    expect(beats.map((beat) => beat.text)).toContain("Apocalypse moved to the next stage.");
    expect(beats.map((beat) => beat.text)).not.toContain("Apocalypse was pushed to the next stage.");

    const tips = tipsFor(
      { game, lastEvents: [revealed(villain.instanceId)], perspectiveId: store.state.perspectiveId },
      POOL_DEPS,
      {
        ...defaultGuidePrefs,
        seenTips: [
          "situation:obligation",
          "situation:nemesisSet",
          "situation:mulligan",
          "situation:minionEngaged",
          "situation:sideScheme",
          "situation:crisis",
          "situation:acceleration",
          "situation:boostFlip",
        ],
      },
    );
    expect(tips[0]?.id).toBe("situation:villainStageAdvanced");
    expect(tips[0]?.body).toMatch(/card effect/);
  });
});
