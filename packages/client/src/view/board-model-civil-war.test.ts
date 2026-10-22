/**
 * Civil War on the board (docs/phase7-wave10-client.md C12, sections 5.2 and 5.4): the leader's panel, the facedown boost
 * cards it holds between activations, and the defeated allies facedown under the main scheme. A real Captain America
 * game built by `wave10Scenario` (the wave is not in the client pool yet, so the cards package's data is passed in),
 * with the two pieces of state the engine's own tests reach by play patched in exactly as the engine leaves them.
 */
import { WAVE10_DEPS, wave10Scenario } from "@mc/cards";
import { applyCommand, createGame, mainSchemeValue, type GameState, type InstanceId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { boardModel, boostNoteOf } from "./board-model.js";

let game: GameState;
let me: string;
const TARGET = 7;

function settled(state: GameState): GameState {
  let current = state;
  for (let guard = 0; current.pendingChoice && current.step.phase !== "player"; guard++) {
    if (guard > 300) throw new Error("setup choices did not settle");
    const choice = current.pendingChoice;
    const picked =
      choice.prompt.kind === "declareDefender" ? ["decline"] : choice.options.slice(0, choice.minSelections);
    const ids = picked.map((entry) => (typeof entry === "string" ? entry : entry.optionId));
    const result = applyCommand(
      current,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: ids },
      WAVE10_DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    current = result.state;
  }
  return current;
}

beforeAll(() => {
  const created = createGame(
    wave10Scenario("resistance-captain-america", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    }),
    WAVE10_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  game = settled(created.state);
  me = game.players[0]!.playerId;
}, 120_000);

const model = (state: GameState) => boardModel(state, me as never, WAVE10_DEPS);

/** Any minion or ally card of the pool as an instance, moved out of whatever zone held it. */
function stripFromZones(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    players: state.players.map((seat) => ({
      ...seat,
      hand: seat.hand.filter((entry) => entry !== id),
      deck: seat.deck.filter((entry) => entry !== id),
      playArea: seat.playArea.filter((entry) => entry !== id),
    })),
  };
}

function allyInstance(state: GameState): InstanceId {
  const found = state.players[0]!.hand.find((id) => state.cardPool[state.instances[id]!.cardId]?.type === "ally");
  const fromDeck = state.players[0]!.deck.find((id) => state.cardPool[state.instances[id]!.cardId]?.type === "ally");
  return (found ?? fromDeck)!;
}

describe("the leader's panel", () => {
  test("is flagged as a leader and says so in its subtitle", () => {
    const panel = model(game).villain!;
    expect(panel.leader).toBe(true);
    expect(panel.subtitle).toBe("Leader · Stage I");
    expect(panel.boostCount).toBe(0);
    expect(panel.boostNote).toBeUndefined();
  });
});

describe("facedown boost cards held by the leader between activations", () => {
  test("are counted and described, and never named", () => {
    const leaderId = game.activeVillainId!;
    const ally = allyInstance(game);
    const state: GameState = {
      ...stripFromZones(game, ally),
      instances: {
        ...game.instances,
        [leaderId]: { ...game.instances[leaderId]!, boostCards: [ally] },
        [ally]: { ...game.instances[ally]!, faceup: false },
      },
    };
    const panel = model(state).villain!;
    expect(panel.boostCount).toBe(1);
    expect(panel.boostNote).toBe(
      "1 facedown boost card waiting, turned up at the next activation in addition to the one dealt",
    );
    expect(JSON.stringify(panel)).not.toContain(state.cardPool[state.instances[ally]!.cardId]!.name);
  });

  test("the plural", () => {
    expect(boostNoteOf(2)).toBe(
      "2 facedown boost cards waiting, turned up at the next activation in addition to the one dealt",
    );
  });
});

describe("defeated allies facedown under the main scheme", () => {
  test("nothing under it: no row, no label, no target note", () => {
    const scheme = model(game).mainScheme;
    expect(scheme).toMatchObject({ tucked: [], tuckedCount: 0, tuckedLabel: null, targetNote: null });
  });

  test("a facedown ally is a card back counted under the label, and the target is the engine's number", () => {
    const ally = allyInstance(game);
    const mainId = game.mainScheme.instanceId;
    const state: GameState = {
      ...stripFromZones(game, ally),
      instances: {
        ...game.instances,
        [mainId]: { ...game.instances[mainId]!, tucked: [ally] },
        [ally]: { ...game.instances[ally]!, faceup: false },
      },
    };
    const scheme = model(state).mainScheme;
    const engineTarget = mainSchemeValue(state, "targetThreat", WAVE10_DEPS);
    expect(scheme.target).toBe(engineTarget);
    expect(engineTarget).toBe(TARGET);
    expect(scheme.tuckedCount).toBe(1);
    expect(scheme.tucked).toEqual([{ instanceId: ally, faceup: false, name: "Facedown card", art: null }]);
    expect(scheme.tuckedLabel).toBe("Defeated allies, facedown: 1");
    expect(scheme.targetNote).toBe(`Target ${engineTarget}, 1 under it`);
  });

  test("a faceup card under a scheme gets the plain label", () => {
    const ally = allyInstance(game);
    const mainId = game.mainScheme.instanceId;
    const state: GameState = {
      ...stripFromZones(game, ally),
      instances: {
        ...game.instances,
        [mainId]: { ...game.instances[mainId]!, tucked: [ally] },
        [ally]: { ...game.instances[ally]!, faceup: true },
      },
    };
    expect(model(state).mainScheme.tuckedLabel).toBe("Under this scheme: 1");
  });
});
