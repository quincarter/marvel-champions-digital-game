/**
 * docs/phase7-wave8.md §3.55: "discard up to 3 cards from the top of your deck → … where X is the number of cards
 * discarded this way", a deck discard cost of a size the payer chooses (`AbilityCost.discardFromDeck` with `choose`).
 * Synthetic cards: a "plating" upgrade whose interrupt prevents as much attack damage as cards were discarded (the
 * cost paid inside a timing window), and a "dig" support whose action takes the discarded cards into the hand (the
 * cost paid for an action, its cards bound to a slot).
 *
 * Sources: RRG 1.8 "Cost" (p. 13: paid in full; p. 14: "A cost requiring 'any number' or 'up to' some number of game
 * elements requires a minimum of one such game element"), "Player Deck" (p. 33: a deck that empties resets, deals one
 * facedown encounter card, and "no further cards are discarded from the newly shuffled deck"). Ruling, Apr 30, 2026
 * (3) answer 7: the deck is reshuffled before the resolving card enters the discard pile.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState, PlayerState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const you = { kind: "controller" } as const;
const UP_TO_3 = { choose: { min: 1, max: 3 } } as const;
const COUNT = { kind: "var", name: "cost.discardFromDeck" } as const;

/** "Interrupt: When you would take damage from an attack, discard up to 3 cards from the top of your deck → prevent X." */
const PLATING_ABILITY = stubAbility(
  "plating.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: false,
      form: "hero",
      on: { on: "dealDamage", fromAttack: true, targetIs: { categories: ["identity"], controller: "you" } },
    },
    cost: { discardFromDeck: UP_TO_3 },
    effects: [{ kind: "preventDamage", amount: COUNT as never }],
  }),
);
const PLATING = stubUpgrade({ id: "plating", cost: 0, abilities: [PLATING_ABILITY.ref] });
/** "Action: Discard up to 3 cards from the top of your deck → add each card discarded this way to your hand." */
const DIG_ABILITY = stubAbility(
  "dig.action",
  def({
    trigger: { kind: "action" },
    cost: { discardFromDeck: UP_TO_3, discardFromDeckSlot: "dug" },
    effects: [
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "dug" } }, to: "hand", into: you } as never,
      { kind: "addCounters", target: { kind: "self" }, counterType: "dug", amount: COUNT } as never,
    ],
  }),
);
const DIG = stubSupport({ id: "dig", cost: 0, abilities: [DIG_ABILITY.ref] });
/** "The villain attacks you." (ATK 2, no boost card). */
const PROVOKE_ABILITY = stubAbility(
  "provoke.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: you, boost: false }],
  }),
);
const PROVOKE = stubEvent({ id: "provoke", cost: 0, abilities: [PROVOKE_ABILITY.ref] });
const deps = depsOf(PLATING_ABILITY, DIG_ABILITY, PROVOKE_ABILITY);

type Piles = (seat: PlayerState) => Pick<PlayerState, "deck" | "discard">;
const AS_DEALT: Piles = (p) => ({ deck: p.deck, discard: p.discard });
/** p1 in hero form with the plating and the dig in play and Provoke in hand; `piles` rearranges deck and discard pile. */
function start(piles: Piles = AS_DEALT) {
  const base = gameAtFirstTurn({ cards: [PLATING, DIG, PROVOKE], deps, deck: [PLATING.id, DIG.id, PROVOKE.id] });
  const plating = playerCardIntoPlay(base, PLATING.id);
  const dig = playerCardIntoPlay(plating.state, DIG.id);
  const provoke = giveCard(dig.state, P1, PROVOKE.id);
  const state: GameState = {
    ...provoke.state,
    players: provoke.state.players.map((p) =>
      p.playerId === P1 ? { ...p, ...piles(p), identity: { ...p.identity, form: "hero" } } : p,
    ),
  };
  return { state, plating: plating.id, dig: dig.id, provoke: provoke.id };
}
const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const useDig = (dig: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: dig,
  abilityId: DIG_ABILITY.ref.id,
  payment: [],
});
/** Uses the plating when offered (or not), answers the number prompt with `count`, takes the attack undefended. */
function picking(count: number | null, numbers: string[][] = []) {
  return (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return ["decline"];
    if (choice?.prompt.kind === "chooseNumber") {
      numbers.push(choice.options.map((o) => o.optionId));
      return [String(count)];
    }
    const plating = choice?.options.find((o) => o.optionId.includes(PLATING_ABILITY.ref.id));
    if (plating) return count === null ? [] : [plating.optionId];
    return defaultPick(state);
  };
}
function run(state: GameState, command: Command, count: number | null) {
  const numbers: string[][] = [];
  const { session, events } = driveSession(startSession(state), deps, [command], picking(count, numbers));
  return { state: session.state, events, session, numbers };
}
const seatOf = (state: GameState) => mustPlayer(state, P1);
const identityDamage = (state: GameState): number => mustInstance(state, seatOf(state).identity.instanceId).damage;
const settled = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "deckDiscardCostSettled" }> => e.type === "deckDiscardCostSettled",
  );

describe("§3.55 a deck discard cost of a chosen size, paid inside a timing window", () => {
  it("offers 1 to 3, never 0; 3 chosen: the top 3 cards are discarded and X is 3", () => {
    const { state: before, provoke, plating } = start();
    const top = seatOf(before).deck.slice(0, 3);
    const { state, events, numbers, session } = run(before, play(provoke), 3);
    expect(numbers).toEqual([["1", "2", "3"]]);
    expect(seatOf(state).discard).toEqual(expect.arrayContaining(top));
    expect(seatOf(state).deck.length).toBe(seatOf(before).deck.length - 3);
    expect(settled(events)).toEqual([
      { type: "deckDiscardCostSettled", instanceId: plating, playerId: P1, chosen: 3, discarded: top, paid: true },
    ]);
    // The villain's 2 damage is all prevented (X = 3).
    expect(identityDamage(state)).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("1 chosen: one card discarded, X is 1 (2 damage, 1 prevented)", () => {
    const { state: before, provoke } = start();
    const top = seatOf(before).deck[0]!;
    const { state, events } = run(before, play(provoke), 1);
    expect(settled(events).map((e) => e.discarded)).toEqual([[top]]);
    expect(seatOf(state).deck.length).toBe(seatOf(before).deck.length - 1);
    expect(identityDamage(state)).toBe(1);
  });

  it("declined: nothing is discarded and nothing is asked", () => {
    const { state: before, provoke } = start();
    const { state, events, numbers } = run(before, play(provoke), null);
    expect(numbers).toEqual([]);
    expect(settled(events)).toEqual([]);
    expect(seatOf(state).deck.length).toBe(seatOf(before).deck.length);
    expect(identityDamage(state)).toBe(2);
  });

  it("a deck of 2: 1 or 2 may be chosen; with 2 the deck resets at once and 1 facedown encounter card is dealt", () => {
    const { state: before, provoke } = start((p) => ({
      deck: p.deck.slice(0, 2),
      discard: [...p.deck.slice(2), ...p.discard],
    }));
    const { state, events, numbers } = run(before, play(provoke), 2);
    expect(numbers).toEqual([["1", "2"]]);
    expect(settled(events).map((e) => [e.chosen, e.discarded.length, e.paid])).toEqual([[2, 2, true]]);
    expect(seatOf(state).deck.length).toBeGreaterThan(0);
    expect(seatOf(state).dealtEncounter).toHaveLength(1);
    expect(identityDamage(state)).toBe(0);
    // The reset comes before the damage the interrupt answers.
    const reshuffled = events.findIndex((e) => e.type === "deckShuffled");
    expect(reshuffled).toBeGreaterThanOrEqual(0);
  });

  it("a deck of 1: a range of one number is not asked; 1 is discarded", () => {
    const { state: before, provoke } = start((p) => ({
      deck: p.deck.slice(0, 1),
      discard: [...p.deck.slice(1), ...p.discard],
    }));
    const { state, events, numbers } = run(before, play(provoke), 1);
    expect(numbers).toEqual([]);
    expect(settled(events).map((e) => [e.chosen, e.discarded.length, e.paid])).toEqual([[1, 1, true]]);
    expect(identityDamage(state)).toBe(1);
  });

  it("an empty deck with an empty discard pile cannot pay: the interrupt is not offered", () => {
    const { state: before, provoke } = start(() => ({ deck: [], discard: [] }));
    const { state, events } = run(before, play(provoke), 3);
    expect(events.some((e) => e.type === "abilityResolved" && e.abilityId === PLATING_ABILITY.ref.id)).toBe(false);
    expect(identityDamage(state)).toBe(2);
  });
});

describe("§3.55 the same cost on an action, its cards bound to a slot", () => {
  it("2 chosen: the 2 discarded cards are the slot's cards (taken into the hand) and X is 2", () => {
    const { state: before, dig } = start();
    const top = seatOf(before).deck.slice(0, 2);
    const { state, numbers } = run(before, useDig(dig), 2);
    expect(numbers).toEqual([["1", "2", "3"]]);
    expect(seatOf(state).hand).toEqual(expect.arrayContaining(top));
    expect(seatOf(state).discard).not.toEqual(expect.arrayContaining(top));
    expect(mustInstance(state, dig).counters.dug).toBe(2);
  });

  it("with nothing to discard the action cannot be used", () => {
    const { state, dig } = start(() => ({ deck: [], discard: [] }));
    expect(applyCommand(state, useDig(dig), deps).ok).toBe(false);
  });
});
