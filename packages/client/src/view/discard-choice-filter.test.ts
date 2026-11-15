/**
 * A discard cost that names which cards may pay it offers only those cards. Kang's Stolen Memories (11019): "Alter-Ego
 * Action: Discard a [mental] resource from your hand → discard this obligation." A Discord report (Black Panther vs
 * Kang) picked Wakanda Forever! (01043d, a printed wild) for it, and the "DISCARDING 1 (1)" bar left Confirm disabled
 * with no way forward: the picker offered the whole hand while the engine, rightly, refused the wild.
 *
 * The engine's refusal is the ruling: a wild resource counts as another type only when it is spent, so "discard a
 * [mental] resource" needs a printed [mental] icon (FFG ruling 186, September 2024, on this very card; RRG 1.8 "Wild
 * Resource", p. 48). The picker must agree with it.
 */

import {
  applyCommand,
  cardOf,
  getPlayer,
  legalActions,
  type GameState,
  type InstanceId,
  type LegalAction,
  type PlayerId,
} from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { beginDiscardChoice, discardChoiceView, toggleDiscardChoice } from "./discard-choice-model.js";

const STOLEN_MEMORIES = "11019";
const GENIUS = "04024"; // printed [mental]
const WAKANDA_FOREVER = "01043d"; // printed wild

let game: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "kang",
    difficulty: "standard",
    players: [{ starterDeckId: "core-black-panther-protection" }],
    seed: 3,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  game = store.state.game!;
  me = store.state.perspectiveId!;
}, 60_000);

interface Staged {
  readonly state: GameState;
  readonly obligation: InstanceId;
  readonly mental: readonly InstanceId[];
  readonly wild: InstanceId;
}

/**
 * Stands Stolen Memories in the player's play area and sets the hand to `mentalCount` Geniuses, one Wakanda Forever!
 * and nothing else, by relabeling deck cards (the "swap the data, keep the instance" convention other tests use).
 */
function stage(mentalCount: number): Staged {
  const player = getPlayer(game, me)!;
  const deckId = Object.keys(game.encounterDecks)[0]!;
  const obligation = game.encounterDecks[deckId]!.deck[0]!;
  const fromDeck = player.deck.slice(0, mentalCount + 1);
  const mental = fromDeck.slice(0, mentalCount);
  const wild = fromDeck[mentalCount]!;
  const instances = { ...game.instances };
  instances[obligation] = {
    ...instances[obligation]!,
    cardId: STOLEN_MEMORIES as never,
    faceup: true,
    controllerId: me,
  };
  for (const id of mental) instances[id] = { ...instances[id]!, cardId: GENIUS as never, faceup: true };
  instances[wild] = { ...instances[wild]!, cardId: WAKANDA_FOREVER as never, faceup: true };
  const state = {
    ...game,
    instances,
    encounterDecks: {
      ...game.encounterDecks,
      [deckId]: { ...game.encounterDecks[deckId]!, deck: game.encounterDecks[deckId]!.deck.slice(1) },
    },
    players: game.players.map((each) =>
      each.playerId === me
        ? {
            ...each,
            hand: [...mental, wild],
            deck: player.deck.slice(mentalCount + 1),
            playArea: [...player.playArea, obligation],
          }
        : each,
    ),
  } as GameState;
  return { state, obligation, mental, wild };
}

function discardObligation(state: GameState, obligation: InstanceId): LegalAction {
  const legal = legalActions(state, me, POOL_DEPS);
  if (legal.kind !== "turn") throw new Error(`not the player's turn: ${legal.kind}`);
  const entry = legal.legal.find(
    (candidate) => candidate.action.kind === "useAbility" && candidate.action.instanceId === obligation,
  );
  if (!entry) throw new Error("Stolen Memories' Alter-Ego Action is not offered");
  return entry;
}

describe("Stolen Memories' discard cost (11019)", () => {
  test("the setup is what it claims: the wild is printed wild, the Geniuses printed mental, and the engine refuses the wild", () => {
    const { state, obligation, wild } = stage(2);
    expect(cardOf(state, wild)?.name).toBe("Wakanda Forever!");
    const action = discardObligation(state, obligation);
    const withWild = { ...action.example, costChoices: { discard: [wild] } } as typeof action.example;
    expect(applyCommand(state, withWild, POOL_DEPS).ok).toBe(false);
  });

  test("the picker offers only the printed [mental] cards, so a wild can never be picked", () => {
    const { state, obligation, mental, wild } = stage(2);
    const choice = beginDiscardChoice(state, me, discardObligation(state, obligation), POOL_DEPS);
    expect(choice).not.toBeNull();
    expect([...choice!.candidates].sort()).toEqual([...mental].sort());
    expect(choice!.candidates).not.toContain(wild);
    expect(toggleDiscardChoice(choice!, wild).picked).toEqual([]);
  });

  test("picking a [mental] card enables Confirm with a command the engine accepts", () => {
    const { state, obligation, mental } = stage(2);
    const choice = beginDiscardChoice(state, me, discardObligation(state, obligation), POOL_DEPS)!;
    const view = discardChoiceView(state, toggleDiscardChoice(choice, mental[1]!), POOL_DEPS);
    expect(view.blockedBy).toBeNull();
    expect(view.command).not.toBeNull();
    const result = applyCommand(state, view.command!, POOL_DEPS);
    expect(result.ok).toBe(true);
  });

  test("with one [mental] card and a wild there is no choice to make: no picker, and the engine's own pick is the [mental] card", () => {
    const { state, obligation, mental } = stage(1);
    const action = discardObligation(state, obligation);
    expect(beginDiscardChoice(state, me, action, POOL_DEPS)).toBeNull();
    const example = action.example as { costChoices?: { discard?: readonly InstanceId[] } };
    expect(example.costChoices?.discard).toEqual([mental[0]]);
    expect(applyCommand(state, action.example, POOL_DEPS).ok).toBe(true);
  });
});
