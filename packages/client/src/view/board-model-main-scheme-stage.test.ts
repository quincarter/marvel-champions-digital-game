/**
 * The main scheme panel's caption names the stage the card prints, not the stage's position in the card's own
 * `stages` list. Mansion Attack's main scheme card lists four stage-2 faces (the Atrium, the Cafeteria, ...), so the
 * position-based caption read "Main scheme 3" over a card printed stage 2 (QA, issue #4).
 */
import { describe, expect, test } from "vitest";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { boardModel, faceOf } from "./board-model.js";
import { CARDS_BY_ID, POOL_DEPS } from "../content/pool.js";

async function started(scenarioId: string): Promise<{ state: GameState; perspective: PlayerId }> {
  const config: SessionConfig = {
    scenarioId,
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  };
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  return { state: store.state.game!, perspective: store.state.perspectiveId! };
}

const stagesOf = (state: GameState) => {
  const card = CARDS_BY_ID.get(state.mainScheme.cardId as string);
  if (!card || card.type !== "main_scheme") throw new Error("expected a main scheme card");
  return card.stages;
};

describe("main scheme caption uses the printed stage number", () => {
  test("Mansion Attack: every stage of the card reads its own printed number, and the list position would not", async () => {
    const { state, perspective } = await started("mansion-attack");
    const stages = stagesOf(state);
    let differs = 0;
    stages.forEach((stage, index) => {
      const at: GameState = { ...state, mainScheme: { ...state.mainScheme, stageIndex: index } };
      const subtitle = boardModel(at, perspective, POOL_DEPS).mainScheme.subtitle;
      expect(subtitle.startsWith(`Main scheme ${stage.stageNumber}${stage.stageLetter?.toUpperCase() ?? ""}`)).toBe(
        true,
      );
      if (stage.stageNumber !== index + 1) differs += 1;
    });
    expect(differs).toBeGreaterThan(0);
  });

  test("a stage in the victory display keeps its own art after the scheme moves on", async () => {
    const { state } = await started("mansion-attack");
    const scheme = state.mainScheme.instanceId;
    const stage = "spent-stage" as InstanceId;
    const at: GameState = {
      ...state,
      mainScheme: { ...state.mainScheme, stageIndex: 1 },
      instances: { ...state.instances, [stage]: { ...state.instances[scheme]!, mainSchemeStageIndex: 0 } },
      victoryDisplay: [stage],
    };
    expect(faceOf(at, stage)).toEqual({ kind: "mainSchemeStage", stageIndex: 0, side: "B" });
    expect(faceOf(at, scheme)).toEqual({ kind: "mainSchemeStage", stageIndex: 1, side: "B" });
  });

  test("a plain scenario still reads its stage 1", async () => {
    const { state, perspective } = await started("rhino");
    expect(boardModel(state, perspective, POOL_DEPS).mainScheme.subtitle).toMatch(/^Main scheme 1/);
  });
});
