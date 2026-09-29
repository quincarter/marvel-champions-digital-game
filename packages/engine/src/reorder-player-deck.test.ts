/**
 * docs/phase7-wave5.md §4.1 Q60: "look at the top 4 cards of a player deck … put the others on the top and/or bottom of
 * that deck in any order" (`EffectSpec reorderCards`, `to: "playerDeckTopOrBottom"`). A synthetic event shaped like
 * Global Logistics (`sm` 27043, two players), next to the encounter-deck form (§3.48) it shares its questions with.
 *
 * Sources: RRG 1.8 "Deck" (p. 15): a deck's order changes only when a card instructs it; "Look, Looked-At" (p. 27): the
 * looked-at cards stay part of the deck, and only the resolving player sees them.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { ChoicePrompt, PendingChoice } from "./choices.js";
import { replay } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, mustPlayer } from "./query.js";
import type { EffectSpec, PlayerRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const looked = { kind: "ref", ref: { kind: "slot", slot: "looked" } } as const;
const tossed = { kind: "ref", ref: { kind: "slot", slot: "tossed" } } as const;
const four = { kind: "const", value: 4 } as const;

/** Look at the top 4 of `owner`'s deck, discard any number, put the rest on the top and/or bottom of that deck. */
const playerDeckEffects = (owner: PlayerRef): readonly EffectSpec[] => [
  { kind: "selectCards", slot: "looked", cards: { kind: "zone", zone: "deck", player: owner, top: four } },
  { kind: "chooseCards", slot: "tossed", from: looked, chooser: you, min: 0, max: 4 },
  { kind: "moveCards", cards: tossed, to: "discard" },
  {
    kind: "reorderCards",
    cards: { ...looked, filter: { excludeSlots: ["tossed"] } },
    chooser: you,
    to: "playerDeckTopOrBottom",
    deckOwner: owner,
  },
];
const ENCOUNTER_EFFECTS: readonly EffectSpec[] = [
  { kind: "selectCards", slot: "looked", cards: { kind: "encounter", zones: ["deck"], top: four } },
  { kind: "chooseCards", slot: "tossed", from: looked, chooser: you, min: 0, max: 4 },
  { kind: "moveCards", cards: tossed, to: "discard" },
  {
    kind: "reorderCards",
    cards: { ...looked, filter: { excludeSlots: ["tossed"] } },
    chooser: you,
    to: "encounterDeckTopOrBottom",
  },
];

const OWN = stubAbility("logistics-own.action", { trigger: { kind: "action" }, effects: playerDeckEffects(you) });
const OTHER = stubAbility("logistics-other.action", {
  trigger: { kind: "action" },
  effects: playerDeckEffects({ kind: "others", of: you }),
});
const ENCOUNTER = stubAbility("logistics-encounter.action", {
  trigger: { kind: "action" },
  effects: ENCOUNTER_EFFECTS,
});
const OWN_CARD = stubEvent({ id: "logistics-own", cost: 0, abilities: [OWN.ref] });
const OTHER_CARD = stubEvent({ id: "logistics-other", cost: 0, abilities: [OTHER.ref] });
const ENCOUNTER_CARD = stubEvent({ id: "logistics-encounter", cost: 0, abilities: [ENCOUNTER.ref] });
const CARDS = [OWN_CARD, OTHER_CARD, ENCOUNTER_CARD];
const deps = depsOf(OWN, OTHER, ENCOUNTER);

type Variant = "own" | "other" | "encounter";
const CARD_OF: Record<Variant, CardId> = { own: OWN_CARD.id, other: OTHER_CARD.id, encounter: ENCOUNTER_CARD.id };

function setup(variant: Variant): { readonly state: GameState; readonly card: InstanceId } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, players: 2, deck: [CARD_OF[variant]] });
  const given = giveCard(base, P1, CARD_OF[variant]);
  return { state: given.state, card: given.id };
}

const deckOf = (state: GameState, player: PlayerId): readonly InstanceId[] => mustPlayer(state, player).deck;
const startDeck = (variant: Variant): readonly InstanceId[] => {
  const { state } = setup(variant);
  if (variant === "encounter") return activeEncounterDeck(state).deck;
  return deckOf(state, variant === "own" ? P1 : P2);
};

/** Plays the event, answering each question with the next of `answers`, and checks the log replays to the same state. */
function play(
  variant: Variant,
  answers: readonly (readonly InstanceId[])[],
): { readonly state: GameState; readonly asked: readonly PendingChoice[] } {
  const { state: start, card } = setup(variant);
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
const TOSS: ChoicePrompt = { kind: "chooseCards", slot: "tossed" };
const split = (deckOwner: PlayerId): ChoicePrompt => ({ kind: "chooseBottomCards", deck: "playerDeck", deckOwner });
const orderTop = (deckOwner: PlayerId): ChoicePrompt => ({ kind: "orderCards", to: "playerDeckTop", deckOwner });
const orderBottom = (deckOwner: PlayerId): ChoicePrompt => ({ kind: "orderCards", to: "playerDeckBottom", deckOwner });

describe("§4.1 Q60 'put the others on the top and/or bottom of that [player] deck in any order'", () => {
  it("top only: the kept cards go back on top in the chosen order", () => {
    const deck = startDeck("own");
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const { state, asked } = play("own", [[], [], [c, a, d, b]]);
    expect(prompts(asked)).toEqual([TOSS, split(P1), orderTop(P1)]);
    expect(asked[1]).toMatchObject({ playerId: P1, minSelections: 0, maxSelections: 4, ordered: false });
    const after = deckOf(state, P1);
    expect(after.slice(0, 5)).toEqual([c, a, d, b, e]);
    expect(after).toHaveLength(deck.length);
  });

  it("bottom only: every kept card goes under the deck, the last one chosen becoming its bottom card", () => {
    const deck = startDeck("own");
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const { state, asked } = play("own", [[], [a, b, c, d], [b, d, a, c]]);
    expect(prompts(asked)).toEqual([TOSS, split(P1), orderBottom(P1)]);
    const after = deckOf(state, P1);
    expect(after[0]).toBe(e);
    expect(after.slice(-4)).toEqual([b, d, a, c]);
    expect(after).toHaveLength(deck.length);
  });

  it("a split with a discard: the top pile and the bottom pile are each ordered top-down", () => {
    const deck = startDeck("own");
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    // Discard nothing; b and d to the bottom (d above b), then a above c on top.
    const { state, asked } = play("own", [[], [b, d], [c, a], [d, b]]);
    expect(prompts(asked)).toEqual([TOSS, split(P1), orderTop(P1), orderBottom(P1)]);
    const after = deckOf(state, P1);
    expect(after.slice(0, 3)).toEqual([c, a, e]);
    expect(after.slice(-2)).toEqual([d, b]);
    expect(after).toHaveLength(deck.length);

    // One discarded, one on each side left of the other three: no order to ask for a single-card pile.
    const second = play("own", [[a], [b], [d, c]]);
    expect(prompts(second.asked)).toEqual([TOSS, split(P1), orderTop(P1)]);
    const deckAfter = deckOf(second.state, P1);
    expect(deckAfter.slice(0, 3)).toEqual([d, c, e]);
    expect(deckAfter.at(-1)).toBe(b);
    expect(mustPlayer(second.state, P1).discard).toContain(a);
  });

  it("another player's deck: the cards go back into that deck, and the resolving player answers", () => {
    const deck = startDeck("other");
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const ownBefore = deckOf(setup("other").state, P1);
    const { state, asked } = play("other", [[], [a], [d, c, b]]);
    expect(prompts(asked)).toEqual([TOSS, split(P2), orderTop(P2)]);
    expect(asked.every((choice) => choice.playerId === P1)).toBe(true);
    const after = deckOf(state, P2);
    expect(after.slice(0, 4)).toEqual([d, c, b, e]);
    expect(after.at(-1)).toBe(a);
    expect(deckOf(state, P1)).toEqual(ownBefore);
  });

  it("the encounter deck still asks the encounter prompts and reorders the encounter deck", () => {
    const deck = startDeck("encounter");
    const [a, b, c, d, e] = deck as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    const { state, asked } = play("encounter", [[], [b], [c, a, d]]);
    expect(prompts(asked)).toEqual([
      TOSS,
      { kind: "chooseBottomCards", deck: "encounterDeck" },
      { kind: "orderCards", to: "encounterDeckTop" },
    ]);
    const after = activeEncounterDeck(state).deck;
    expect(after.slice(0, 4)).toEqual([c, a, d, e]);
    expect(after.at(-1)).toBe(b);
  });
});
