/**
 * Issue 139: a separate game area's own stage (Kang's stage 3 alternatives, which share the one "Kang's Arrival" card
 * id) is a main scheme. The board drew it as a side scheme: the bare card name, no threat limit, and the stage 1 face
 * when inspected.
 */
import { describe, expect, test } from "vitest";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { boardModel, faceOf } from "./board-model.js";
import { CARDS_BY_ID, POOL_DEPS } from "../content/pool.js";

async function started(): Promise<{ state: GameState; perspective: PlayerId }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "kang",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  return { state: store.state.game!, perspective: store.state.perspectiveId! };
}

/** The state with a second instance of the central scheme card, at `stageIndex`, as a game area's own stage. */
function withAreaStage(state: GameState, stageIndex: number): { state: GameState; id: InstanceId } {
  const id = "area-stage" as InstanceId;
  const central = state.instances[state.mainScheme.instanceId]!;
  const at: GameState = {
    ...state,
    instances: { ...state.instances, [id]: { ...central, instanceId: id, threat: 2 } },
    gameAreas: [
      {
        areaId: "a0" as GameState["gameAreas"][number]["areaId"],
        playerIds: state.players.map((p) => p.playerId),
        mainScheme: { ...state.mainScheme, instanceId: id, stageIndex },
        villainIds: [],
        activeVillainId: null,
        sideSchemeIds: [],
        formerSchemeIds: [],
      },
    ],
  };
  return { state: at, id };
}

describe("a game area's own main scheme stage", () => {
  test("is a main scheme panel named for its stage, with its threat limit, not a side scheme", async () => {
    const { state, perspective } = await started();
    const card = CARDS_BY_ID.get(state.mainScheme.cardId as string);
    if (!card || card.type !== "main_scheme") throw new Error("expected a main scheme card");
    const stageIndex = card.stages.findIndex((stage) => stage.name === "The Present Future War");
    expect(stageIndex).toBeGreaterThanOrEqual(0);

    const { state: at, id } = withAreaStage(state, stageIndex);
    const model = boardModel(at, perspective, POOL_DEPS);

    expect(model.sideSchemes.map((s) => s.instanceId)).not.toContain(id);
    const panel = model.extraMainSchemes.find((s) => s.instanceId === id);
    expect(panel?.name).toBe("The Present Future War");
    expect(panel?.isMain).toBe(true);
    expect(panel?.target).toBe(9);
    expect(panel?.subtitle).toMatch(/^Main scheme 3/);
    expect(panel?.art).not.toBeNull();
    // The central scheme is still the central scheme.
    expect(model.mainScheme.instanceId).toBe(state.mainScheme.instanceId);
  });

  test("inspects its own stage, not the central scheme's", async () => {
    const { state } = await started();
    const card = CARDS_BY_ID.get(state.mainScheme.cardId as string);
    if (!card || card.type !== "main_scheme") throw new Error("expected a main scheme card");
    const stageIndex = card.stages.findIndex((stage) => stage.name === "The Present Future War");
    const { state: at, id } = withAreaStage(state, stageIndex);
    expect(faceOf(at, id)).toEqual({ kind: "mainSchemeStage", stageIndex, side: "B" });
  });
});
