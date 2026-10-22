import { describe, expect, test } from "vitest";
import { SHADOWLAND_SCENARIOS, cardId, trait, type VillainCard } from "@mc/content";
import { playableStarterDeckSetup, wave11Scenario } from "@mc/cards";
import { createGame, type GameState, type InstanceId } from "@mc/engine";
import { CARDS_BY_ID, POOL_DEPS } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { boardModel, characterPanel } from "./board-model.js";
import { appendEvents, emptyLog } from "./log-lines.js";
import { cardName } from "./names.js";

/**
 * Shadow Labyrinth sets its randomly drawn Dark Protégé villain aside facedown, and it must stay unnamed until a card
 * puts it into play (docs/phase7-shadowland.md section 7). The game is the cards builder's own (the pack is gated, so no
 * `playableScenario`), with no pick: the draw is the engine's.
 */
function labyrinthGame() {
  const config = wave11Scenario("shadow-labyrinth", {
    difficulty: "standard",
    players: [playableStarterDeckSetup("core-spider-man-justice")],
    seed: 5,
  });
  const created = createGame(config, POOL_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return created;
}

const options = SHADOWLAND_SCENARIOS.find((s) => s.id === "shadow-labyrinth")!.villainOptions!.options;
const villainNames = options.map((o) => CARDS_BY_ID.get(o.villainCardId as string)!.name);

describe("Shadow Labyrinth's drawn villain stays hidden", () => {
  test("the chosen villain is set aside facedown and every reader calls it a facedown card", () => {
    const { state, events } = labyrinthGame();
    const id = state.chosenVillainId as InstanceId;
    expect(id).toBeDefined();
    expect(state.instances[id]!.faceup).toBe(false);
    expect(state.encounterSetAside).toContain(id);
    expect(cardName(state, id)).toBe("a facedown card");

    // Nothing the board model carries names any of the six villains' own cards.
    const player = state.players[0]!.playerId;
    const model = JSON.stringify(boardModel(state, player, POOL_DEPS));
    for (const name of villainNames) expect(model, name).not.toContain(`"${name}"`);

    // Nor does a line of the setup log.
    const log = appendEvents(emptyLog(), events, state, player, POOL_DEPS);
    const text = log.lines.map((line) => line.text).join("\n");
    const chosenName = CARDS_BY_ID.get(state.instances[id]!.cardId as string)!.name;
    expect(text).not.toContain(chosenName);
  });
});

describe("a villain card in play as a minion (Whisper in the Dark)", () => {
  /** The game's state with a Dark Protégé villain card put into play as an Elite minion engaged with seat one. */
  function withLooseMinion(state: GameState, code: string): { state: GameState; id: InstanceId } {
    const seat = state.players[0]!;
    const template = state.instances[state.chosenVillainId as InstanceId]!;
    const id = "loose-villain-1" as InstanceId;
    const instance = {
      ...template,
      instanceId: id,
      cardId: cardId(code),
      faceup: true,
      flipped: false,
      // What Whisper in the Dark's `treatHostAsMinion` records: an Elite minion with 6 printed hit points, text kept.
      treatedAs: {
        kind: "minion" as const,
        traits: [trait("ELITE")],
        keepPrintedTraits: false,
        schFromThw: false,
        source: seat.identity.instanceId,
        controllerBefore: null,
        keepsText: true as const,
        printedHp: 6,
      },
      engagedWith: seat.playerId,
      controllerId: seat.playerId,
      home: { kind: "encounterDeck" as const, deckId: Object.keys(state.encounterDecks)[0]! },
    };
    return {
      id,
      state: {
        ...state,
        instances: { ...state.instances, [id]: instance },
        players: state.players.map((p, i) => (i === 0 ? { ...p, playArea: [...p.playArea, id] } : p)),
      } as unknown as GameState,
    };
  }

  test("the board renders it with its own face and 6 hit points, not the active villain's", () => {
    const code = options[0]!.villainCardId as string;
    const card = CARDS_BY_ID.get(code) as VillainCard;
    const { state, id } = withLooseMinion(labyrinthGame().state, code);
    // The whole board builds (it threw "no villain" on this card before), and the card's panel is the card's own.
    const model = boardModel(state, state.players[0]!.playerId, POOL_DEPS);
    expect(JSON.stringify(model)).toContain(card.name);
    const panel = characterPanel(state, id, POOL_DEPS);
    expect(panel.name).toBe(card.name);
    expect(panel.subtitle).toBe("Minion (treated as)");
    expect(panel.art).toEqual(artFor(card, { kind: "villainStage", sideIndex: 0, stageIndex: 0 }));
    expect(panel.hp?.max).toBe(6);
  });
});

describe("Shadow Labyrinth's 2A with no villain to reveal", () => {
  test("a set-aside, defeated Shifting Corridors is no villain panel: the board shows no villain", () => {
    const { state } = labyrinthGame();
    const corridors = state.villains[0]!;
    // What 2A leaves when the chosen villain is gone from the game: the villain defeated and set aside.
    const aside = {
      ...state,
      villains: state.villains.map((villain) => ({ ...villain, defeated: true })),
      encounterSetAside: [...state.encounterSetAside, corridors.instanceId],
      removedFromGame: [...state.removedFromGame, state.chosenVillainId as InstanceId],
    } as GameState;
    const model = boardModel(aside, state.players[0]!.playerId, POOL_DEPS);
    expect(model.villain).toBeNull();
    expect(model.villains).toEqual([]);
    // Before that, the villain in play is shown as ever.
    expect(boardModel(state, state.players[0]!.playerId, POOL_DEPS).villain).not.toBeNull();
  });
});
