/**
 * "Why can't I use this?" for an ability refused for want of a target (#412): Jessica Jones' obligation Work-Life
 * Balance, "Choose: • Remove an ally you control from the game → … • Confuse your identity → …", in a real game. With
 * Inspiring Pottery (Art Museum Heist 60123) on her she is stalwart and cannot be confused (RRG 1.8 "Stalwart", p. 40),
 * so with no ally the engine refuses the action, and Inspect's "Right now" says which target each option is missing.
 */
import { JJ_STARTER_DECKS, cardId, type AbilityId } from "@mc/content";
import { WAVE11_CARDS, WAVE11_DEPS, coreScenario } from "@mc/cards";
import { applyCommand, createGame, legalActions, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { targetRefusalReason } from "./ability-refusal.js";
import { inspectModel } from "./inspect-model.js";

const DEPS = WAVE11_DEPS;
const WORK_LIFE = "61030";
const POTTERY = "60123";
const WORK_LIFE_A = "61030.work-life-balance-action" as AbilityId;
const NO_ALLY = "you control no ally";

let game: GameState;
let me: PlayerId;
let identity: InstanceId;
let workLife: InstanceId;

/** Jessica Jones alone against Core's Rhino, past setup, in alter-ego form. */
function jessicaGame(): GameState {
  const deck = JJ_STARTER_DECKS[0]!;
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap((line) => Array.from({ length: line.quantity }, () => line.cardId)),
  };
  const created = createGame({ ...base, players: [seat], requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = created.state;
  for (let guard = 0; state.pendingChoice && state.step.phase !== "player"; guard++) {
    if (guard > 300) throw new Error("setup choices did not settle");
    const choice = state.pendingChoice;
    const ids = choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
    const result = applyCommand(
      state,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: ids },
      DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

/** Surgery: `id` out of every pile and into `player`'s play area, faceup; with `host`, attached to it instead. */
function intoPlay(state: GameState, id: InstanceId, player: PlayerId, host: InstanceId | null = null): GameState {
  const out = (pile: readonly InstanceId[]) => pile.filter((x) => x !== id);
  const players = state.players.map((p) => ({
    ...p,
    deck: out(p.deck),
    hand: out(p.hand),
    discard: out(p.discard),
    playArea: p.playerId === player && host === null ? [...out(p.playArea), id] : out(p.playArea),
  }));
  const encounterDecks = Object.fromEntries(
    Object.entries(state.encounterDecks).map(([key, pile]) => [
      key,
      { ...pile, deck: out(pile.deck), discard: out(pile.discard) },
    ]),
  );
  const instances = {
    ...state.instances,
    [id]: { ...state.instances[id]!, faceup: true, controllerId: player, attachedTo: host },
    ...(host
      ? { [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] } }
      : {}),
  };
  return { ...state, players, encounterDecks, instances } as GameState;
}

const withPottery = (state: GameState): GameState => {
  const pottery = state.players[0]!.deck[0]!;
  const relabelled = {
    ...state,
    instances: { ...state.instances, [pottery]: { ...state.instances[pottery]!, cardId: cardId(POTTERY) } },
  };
  return intoPlay(relabelled, pottery, me, identity);
};

const confused = (state: GameState): GameState => ({
  ...state,
  instances: {
    ...state.instances,
    [identity]: { ...state.instances[identity]!, statuses: { stunned: 0, confused: 1, tough: 0 } },
  },
});

const rightNow = (state: GameState): string =>
  inspectModel(state, workLife, legalActions(state, me, DEPS), me, DEPS).status.message;

beforeAll(() => {
  const base = jessicaGame();
  me = base.players[0]!.playerId;
  identity = base.players[0]!.identity.instanceId;
  workLife = Object.values(base.instances).find((i) => i.cardId === cardId(WORK_LIFE))!.instanceId;
  game = intoPlay(base, workLife, me);
}, 120_000);

describe("targetRefusalReason (#412)", () => {
  test("Work-Life Balance is usable with no ally while Jessica can be confused: nothing to explain", () => {
    expect(rightNow(game)).toMatch(/^Playable/);
    expect(targetRefusalReason(game, workLife, me, WORK_LIFE_A, DEPS)).toBeNull();
  });

  test("stalwart from Inspiring Pottery and no ally: each option's missing target is named", () => {
    const state = withPottery(game);
    expect(targetRefusalReason(state, workLife, me, WORK_LIFE_A, DEPS)).toBe(
      `${NO_ALLY}, and Jessica Jones is stalwart and cannot be confused`,
    );
    expect(rightNow(state)).toBe(
      `that ability has no valid target: ${NO_ALLY}, and Jessica Jones is stalwart and cannot be confused`,
    );
  });

  test("already confused and no ally: says she is already confused", () => {
    expect(rightNow(confused(game))).toBe(
      `that ability has no valid target: ${NO_ALLY}, and Jessica Jones is already confused`,
    );
  });
});
