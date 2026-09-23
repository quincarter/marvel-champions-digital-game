/**
 * docs/phase7-wave3.md §3.48: "place the rest on the top and/or bottom of the encounter deck in any order"
 * (`EffectSpec reorderCards`, `to: "encounterDeckTopOrBottom"`). A synthetic event shaped like Take the Fight to Them
 * (`gmw` 16161, two players): "Look at the top 4 cards of the encounter deck. Discard any number of those, then place
 * the rest on the top and/or bottom of the encounter deck in any order."
 *
 * Sources: RRG 1.8 "Deck" (p. 15): a deck's order changes only when a card instructs it; "Look, Looked-At" (p. 27): the
 * looked-at cards stay part of the deck, and only the resolving player sees them.
 */

import { describe, expect, it } from "vitest";
import type { ChoicePrompt, PendingChoice } from "./choices.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const looked = { kind: "ref", ref: { kind: "slot", slot: "looked" } } as const;
const EFFECTS: readonly EffectSpec[] = [
  {
    kind: "selectCards",
    slot: "looked",
    cards: { kind: "encounter", zones: ["deck"], top: { kind: "const", value: 4 } },
  },
  { kind: "chooseCards", slot: "tossed", from: looked, chooser: you, min: 0, max: 4 },
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "tossed" } }, to: "discard" },
  {
    kind: "reorderCards",
    cards: { ...looked, filter: { excludeSlots: ["tossed"] } },
    chooser: you,
    to: "encounterDeckTopOrBottom",
  },
];
const TAKE_THE_FIGHT = stubAbility("take-the-fight.action", { trigger: { kind: "action" }, effects: EFFECTS });
const CARD = stubEvent({ id: "take-the-fight", cost: 0, abilities: [TAKE_THE_FIGHT.ref] });
const deps = depsOf(TAKE_THE_FIGHT);

function setup(): { readonly state: GameState; readonly card: InstanceId } {
  const given = giveCard(gameAtFirstTurn({ cards: [CARD], deps, deck: [CARD.id] }), P1, CARD.id);
  return { state: given.state, card: given.id };
}

/** The encounter deck before the event, top first (the same every time: the game is seeded). */
const startDeck = (): readonly InstanceId[] => activeEncounterDeck(setup().state).deck;

/**
 * Plays the event, answering its questions in order with `answers` (one list of instance ids each), and checks that
 * every answer was used and that the log replays to the same state.
 */
function play(answers: readonly (readonly InstanceId[])[]): {
  readonly state: GameState;
  readonly asked: readonly PendingChoice[];
} {
  const { state: start, card } = setup();
  const asked: PendingChoice[] = [];
  const queue = [...answers];
  const { state, session } = runCommandsPicking(
    start,
    deps,
    (s) => {
      const choice = s.pendingChoice;
      if (!choice) return [];
      asked.push(choice);
      const next = queue.shift();
      if (!next) throw new Error(`unexpected question ${JSON.stringify(choice.prompt)}`);
      return next;
    },
    { type: "playCard", playerId: P1, cardInstanceId: card, payment: [], attachToInstanceId: null },
  );
  expect(queue).toEqual([]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(state);
  return { state, asked };
}

const prompts = (asked: readonly PendingChoice[]): readonly ChoicePrompt[] => asked.map((choice) => choice.prompt);
const optionIds = (choice: PendingChoice | undefined): readonly string[] =>
  (choice?.options ?? []).map((o) => o.optionId);
const TOSS: ChoicePrompt = { kind: "chooseCards", slot: "tossed" };
const SPLIT: ChoicePrompt = { kind: "chooseBottomCards", deck: "encounterDeck" };
const ORDER_TOP: ChoicePrompt = { kind: "orderCards", to: "encounterDeckTop" };
const ORDER_BOTTOM: ChoicePrompt = { kind: "orderCards", to: "encounterDeckBottom" };

describe("§3.48 'place the rest on the top and/or bottom of the encounter deck in any order'", () => {
  it("splits the kept cards, then orders each pile top-down: the top pile first, then the bottom pile", () => {
    const deck = startDeck();
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const { state, asked } = play([[], [b, d], [c, a], [d, b]]);
    expect(prompts(asked)).toEqual([TOSS, SPLIT, ORDER_TOP, ORDER_BOTTOM]);
    // The split offers every kept card, none required; each order asks for exactly its pile.
    expect(asked[1]).toMatchObject({ minSelections: 0, maxSelections: 4, ordered: false, playerId: P1 });
    expect(optionIds(asked[1])).toEqual([a, b, c, d]);
    expect(asked[2]).toMatchObject({ minSelections: 2, maxSelections: 2, ordered: true });
    expect(optionIds(asked[2])).toEqual([a, c]);
    expect(asked[3]).toMatchObject({ minSelections: 2, maxSelections: 2, ordered: true });
    expect(optionIds(asked[3])).toEqual([b, d]);
    const after = activeEncounterDeck(state).deck;
    expect(after.slice(0, 3)).toEqual([c, a, e]);
    // Top-down: d above b, so b, the last chosen, is the deck's bottom card.
    expect(after.slice(-2)).toEqual([d, b]);
    expect(after).toHaveLength(deck.length);
  });

  it("all on the bottom: only the bottom pile is ordered, the last card chosen becoming the deck's bottom card", () => {
    const deck = startDeck();
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const { state, asked } = play([[], [a, b, c, d], [c, a, d, b]]);
    expect(prompts(asked)).toEqual([TOSS, SPLIT, ORDER_BOTTOM]);
    const after = activeEncounterDeck(state).deck;
    expect(after[0]).toBe(e);
    expect(after.slice(-4)).toEqual([c, a, d, b]);
  });

  it("none on the bottom: only the top is ordered, as 'put them back in any order'", () => {
    const deck = startDeck();
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const { state, asked } = play([[], [], [b, d, c, a]]);
    expect(prompts(asked)).toEqual([TOSS, SPLIT, ORDER_TOP]);
    expect(activeEncounterDeck(state).deck.slice(0, 5)).toEqual([b, d, c, a, e]);
  });

  it("one card on each side: asked only which goes where, with no order to choose", () => {
    const deck = startDeck();
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const { state, asked } = play([[a, c], [b]]);
    expect(prompts(asked)).toEqual([TOSS, SPLIT]);
    const after = activeEncounterDeck(state);
    expect(after.deck.slice(0, 2)).toEqual([d, e]);
    expect(after.deck.at(-1)).toBe(b);
    expect(after.discard).toEqual(expect.arrayContaining([a, c]));
  });

  it("every card discarded: nothing is left to place, and nothing more is asked", () => {
    const deck = startDeck();
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const { state, asked } = play([[a, b, c, d]]);
    expect(prompts(asked)).toEqual([TOSS]);
    expect(activeEncounterDeck(state).deck[0]).toBe(e);
    expect(activeEncounterDeck(state).deck).toHaveLength(deck.length - 4);
  });
});
