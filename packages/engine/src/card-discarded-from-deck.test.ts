/**
 * docs/phase7-wave7.md §3.55: `TriggerEvent cardDiscardedFromDeck`, a card discarded from the top of a player's deck as
 * an event the discarded card answers from where the discard left it (`AbilityDefinition.activeIn: "discard"`) and a
 * card in play hears. Synthetic cards only:
 *
 * - `back` / `hand` / `fox`: "Response: After this card is discarded from the top of your deck, shuffle it back into
 *   your deck" / "add it to your hand" / "put it into play under your control";
 * - `lady`: "Response: After you discard a card from the top of your deck, attach that card facedown here (to a maximum
 *   of 3)";
 * - `tally`: a forced "after you discard a card from the top of your deck" that counts what it hears;
 * - `tick`: an optional "after you discard a card from the top of your deck, put a counter here", which needs nothing of
 *   the discarded card (issue #928);
 * - `batch`: a forced "after you discard cards from the top of your deck, … for each [justice] card discarded", which
 *   answers the whole discard once (`EventPattern.together`).
 *
 * Sources: RRG 1.8 "In Play and Out of Play" (p. 23), "Ownership and Control" (p. 31: "A player controls the cards in
 * their own out-of-play areas"), "Player Deck" (p. 33), "Triggering Condition" (p. 45); MC40 p. 21 FAQ ("Player decks
 * reset as soon as they are empty, so Domino's deck is reset with Jackpot shuffled into it"); ruling, April 30, 2026 -
 * Ruling 4, answer 1 ("if you do, it does not count for the mission attempt"); owner decisions §4.1 Q31 = A (any
 * effect or cost that discards from that deck), Q32 = B (a card a response took away is not counted by the ability
 * that discarded it), Q33 = A (on the deck's last card the response resolves where the reset put the card).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { TOGETHER_TARGETS_SLOT } from "./select.js";
import type { CardSelector, EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, type StubAbility, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubResource, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1 } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const self: TargetRef = { kind: "self" };
const you = { kind: "controller" } as const;
const def = (definition: AbilityDefinition) => definition;
const constant = (value: number) => ({ kind: "const", value }) as const;
const selfDiscarded = (extra: Partial<EventPattern> = {}): EventPattern => ({
  on: "cardDiscardedFromDeck",
  selfIs: "target",
  ...extra,
});
const youDiscard: EventPattern = { on: "cardDiscardedFromDeck", playerIs: "controller" };
const fromDiscard = (id: string, on: EventPattern, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(id, def({ trigger: { kind: "response", forced: false, on }, effects, activeIn: "discard" }));

// "… shuffle it back into your deck." Not when the deck's reset has just done that (MC40 p. 21).
const BACK_RESPONSE = fromDiscard("back.response", selfDiscarded({ eventIs: { at: "discard" } }), [
  { kind: "moveCards", cards: { kind: "ref", ref: self }, to: "deckShuffle" },
]);
const HAND_RESPONSE = fromDiscard("hand.response", selfDiscarded(), [
  { kind: "moveCards", cards: { kind: "ref", ref: self }, to: "hand" },
]);
const FOX_RESPONSE = fromDiscard("fox.response", selfDiscarded(), [
  { kind: "putIntoPlay", card: self, controller: you },
]);
const underThree = {
  kind: "compare",
  left: { kind: "refCount", of: { kind: "attachmentsOf", of: self } },
  op: "atMost",
  right: constant(2),
} as const;
const LADY_RESPONSE = stubAbility(
  "lady.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard, while: underThree },
    effects: [
      {
        kind: "if",
        condition: underThree,
        then: [{ kind: "attach", card: { kind: "eventTarget" }, to: self, facedown: true }],
      },
    ],
  }),
);
const TALLY_RESPONSE = stubAbility(
  "tally.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: youDiscard },
    effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: constant(1) }],
  }),
);
// Needs nothing of the discarded card: still offered once another response has moved it (issue #928).
const TICK_RESPONSE = stubAbility(
  "tick.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: constant(1) }],
  }),
);
// "Put a counter here and attach that card facedown here": kept once the card is gone, its attach then does nothing.
const MIXED_RESPONSE = stubAbility(
  "mixed.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      { kind: "addCounters", target: self, counterType: "seen", amount: constant(1) },
      { kind: "attach", card: { kind: "eventTarget" }, to: self, facedown: true },
    ],
  }),
);
// The same once for the whole discard (`together`): "put a counter here and attach those cards facedown here".
const GROUP_RESPONSE = stubAbility(
  "group.response",
  def({
    trigger: { kind: "response", forced: false, on: { ...youDiscard, together: true } },
    effects: [
      { kind: "addCounters", target: self, counterType: "seen", amount: constant(1) },
      { kind: "attach", card: { kind: "slot", slot: TOGETHER_TARGETS_SLOT }, to: self, facedown: true },
    ],
  }),
);
// "Add that card to your hand, then set it aside": a response that moves the card itself still names it afterwards.
const RELAY_RESPONSE = stubAbility(
  "relay.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, to: "hand" },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, to: "setAside" },
    ],
  }),
);
const thatCardThere = {
  kind: "compare",
  left: { kind: "refCount", of: { kind: "eventTarget" } },
  op: "atLeast",
  right: constant(1),
} as const;
// "If that card is not in your discard pile any more, put a counter here": read with "that card" naming nothing.
const MISSED_RESPONSE = stubAbility(
  "missed.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "if",
        condition: { kind: "not", of: thatCardThere },
        then: [{ kind: "addCounters", target: self, counterType: "seen", amount: constant(1) }],
      },
    ],
  }),
);
// The same the other way round: "if that card is there, put a counter here". Nothing can come of it once it moved.
const THERE_RESPONSE = stubAbility(
  "there.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "if",
        condition: thatCardThere,
        then: [{ kind: "addCounters", target: self, counterType: "seen", amount: constant(1) }],
      },
    ],
  }),
);
// "Choose one: attach that card facedown here, or remove 1 threat from the main scheme."
const EITHER_RESPONSE = stubAbility(
  "either.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "chooseOne",
        chooser: you,
        options: [
          { label: "attach", effects: [{ kind: "attach", card: { kind: "eventTarget" }, to: self, facedown: true }] },
          { label: "thwart", effects: [{ kind: "removeThreat", target: { kind: "mainScheme" }, amount: constant(1) }] },
        ],
      },
    ],
  }),
);
// Two forced responses that each act on "that card": once one has moved it, the other has no valid target.
const forcedOn = (id: string, effect: EffectSpec): StubAbility =>
  stubAbility(id, def({ trigger: { kind: "response", forced: true, on: youDiscard }, effects: [effect] }));
const GRAB_RESPONSE = forcedOn("grab.forced-response", {
  kind: "moveCards",
  cards: { kind: "ref", ref: { kind: "eventTarget" } },
  to: "hand",
});
const PIN_RESPONSE = forcedOn("pin.forced-response", {
  kind: "attach",
  card: { kind: "eventTarget" },
  to: self,
  facedown: true,
});
// "Set a var, attach that card here, and remove 1 threat from the main scheme": the var is no part of its own.
const NOTED_RESPONSE = stubAbility(
  "noted.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      { kind: "setVar", name: "before", value: constant(1) },
      { kind: "attach", card: { kind: "eventTarget" }, to: self, facedown: true },
      { kind: "removeThreat", target: { kind: "mainScheme" }, amount: constant(1) },
    ],
  }),
);
// "Put 1 counter here, plus 1 for each of that card's printed cost": 1 once that card has gone.
const PLUS_RESPONSE = stubAbility(
  "plus.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "addCounters",
        target: self,
        counterType: "seen",
        amount: { kind: "sum", values: [constant(1), { kind: "printedCost", of: { kind: "eventTarget" } }] },
      },
    ],
  }),
);
// "Set aside that card or the top card of your discard pile": a union with another source.
const EITHER_CARD_RESPONSE = stubAbility(
  "either-card.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "moveCards",
        cards: {
          kind: "anyOf",
          of: [
            { kind: "ref", ref: { kind: "eventTarget" } },
            { kind: "zone", zone: "discard", player: you, top: constant(1) },
          ],
        },
        to: "setAside",
      },
    ],
  }),
);
// "Choose that card. Choose one: attach the chosen card here, or remove 1 threat from the main scheme."
const PICKED_RESPONSE = stubAbility(
  "picked.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "chooseCards",
        slot: "picked",
        from: { kind: "ref", ref: { kind: "eventTarget" } },
        chooser: you,
        min: 0,
        max: 1,
      },
      {
        kind: "chooseOne",
        chooser: you,
        options: [
          {
            label: "attach",
            effects: [{ kind: "attach", card: { kind: "slot", slot: "picked" }, to: self, facedown: true }],
          },
          { label: "thwart", effects: [{ kind: "removeThreat", target: { kind: "mainScheme" }, amount: constant(1) }] },
        ],
      },
    ],
  }),
);
const removeOne: EffectSpec = { kind: "removeThreat", target: { kind: "mainScheme" }, amount: constant(1) };
// Once for the whole discard: "choose one: attach those cards facedown here, or remove 1 threat from the main scheme".
const GROUP_CHOICE_RESPONSE = stubAbility(
  "group-choice.response",
  def({
    trigger: { kind: "response", forced: false, on: { ...youDiscard, together: true } },
    effects: [
      {
        kind: "chooseOne",
        chooser: you,
        options: [
          {
            label: "attach",
            effects: [
              { kind: "attach", card: { kind: "slot", slot: TOGETHER_TARGETS_SLOT }, to: self, facedown: true },
            ],
          },
          { label: "thwart", effects: [removeOne] },
        ],
      },
    ],
  }),
);
// "Put a counter on each support other than that card": an exclusion is no operand.
const OTHERS_RESPONSE = stubAbility(
  "others.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "each", query: { categories: ["support"], excluding: { kind: "eventTarget" } } },
        counterType: "seen",
        amount: constant(1),
      },
    ],
  }),
);
// "Choose one: if that card is still there, draw 1 card; or remove 1 threat from the main scheme."
const NESTED_RESPONSE = stubAbility(
  "nested.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "chooseOne",
        chooser: you,
        options: [
          {
            label: "draw",
            effects: [
              { kind: "if", condition: thatCardThere, then: [{ kind: "draw", player: you, amount: constant(1) }] },
            ],
          },
          { label: "thwart", effects: [removeOne] },
        ],
      },
    ],
  }),
);
// Once for the whole discard, paid by exhausting this card: "attach the first card discarded facedown here" / "attach
// those cards facedown here". The first acts only on "that card" (the first condition's), the second on the group.
const pairedOn = (id: string, card: TargetRef): StubAbility =>
  stubAbility(
    id,
    def({
      trigger: { kind: "response", forced: false, on: { ...youDiscard, together: true } },
      cost: { exhaustSelf: true },
      effects: [{ kind: "attach", card, to: self, facedown: true }],
    }),
  );
const FIRST_ONLY_RESPONSE = pairedOn("first-only.response", { kind: "eventTarget" });
const WHOLE_GROUP_RESPONSE = pairedOn("whole-group.response", { kind: "slot", slot: TOGETHER_TARGETS_SLOT });
// "Choose that card. Choose one: if you chose a card, draw 1 card; or remove 1 threat from the main scheme."
const PICKED_IF_RESPONSE = stubAbility(
  "picked-if.response",
  def({
    trigger: { kind: "response", forced: false, on: youDiscard },
    effects: [
      {
        kind: "chooseCards",
        slot: "picked",
        from: { kind: "ref", ref: { kind: "eventTarget" } },
        chooser: you,
        min: 0,
        max: 1,
      },
      {
        kind: "chooseOne",
        chooser: you,
        options: [
          {
            label: "draw",
            effects: [
              {
                kind: "if",
                condition: {
                  kind: "compare",
                  left: { kind: "refCount", of: { kind: "slot", slot: "picked" } },
                  op: "atLeast",
                  right: constant(1),
                },
                then: [{ kind: "draw", player: you, amount: constant(1) }],
              },
            ],
          },
          { label: "thwart", effects: [removeOne] },
        ],
      },
    ],
  }),
);
// One answer for every [justice] card of the discard: 1 "answers" counter, and 1 "cards" counter for each of them.
const BATCH_RESPONSE = stubAbility(
  "batch.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { ...youDiscard, targetIs: { aspect: "justice" }, together: true } },
    effects: [
      { kind: "addCounters", target: self, counterType: "answers", amount: constant(1) },
      {
        kind: "addCounters",
        target: self,
        counterType: "cards",
        amount: { kind: "refCount", of: { kind: "slot", slot: TOGETHER_TARGETS_SLOT } },
      },
    ],
  }),
);

const FILLER = stubEvent({ id: "filler", cost: 0 });
const MATCH = stubEvent({ id: "match", cost: 0, aspect: "justice" });
const BACK = stubResource({ id: "back", icons: 1, abilities: [BACK_RESPONSE.ref] });
const HAND = stubResource({ id: "hand", icons: 1, abilities: [HAND_RESPONSE.ref] });
const FOX = stubAlly({ id: "fox", cost: 2, atk: 1, thw: 1, hp: 2, abilities: [FOX_RESPONSE.ref] });
const LADY = stubSupport({ id: "lady", cost: 0, abilities: [LADY_RESPONSE.ref] });
const TALLY = stubSupport({ id: "tally", cost: 0, abilities: [TALLY_RESPONSE.ref] });
const TICK = stubSupport({ id: "tick", cost: 0, abilities: [TICK_RESPONSE.ref] });
const MIXED = stubSupport({ id: "mixed", cost: 0, abilities: [MIXED_RESPONSE.ref] });
const GROUP = stubSupport({ id: "group", cost: 0, abilities: [GROUP_RESPONSE.ref] });
const RELAY = stubSupport({ id: "relay", cost: 0, abilities: [RELAY_RESPONSE.ref] });
const MISSED = stubSupport({ id: "missed", cost: 0, abilities: [MISSED_RESPONSE.ref] });
const THERE = stubSupport({ id: "there", cost: 0, abilities: [THERE_RESPONSE.ref] });
const EITHER = stubSupport({ id: "either", cost: 0, abilities: [EITHER_RESPONSE.ref] });
const GRAB = stubSupport({ id: "grab", cost: 0, abilities: [GRAB_RESPONSE.ref] });
const PIN = stubSupport({ id: "pin", cost: 0, abilities: [PIN_RESPONSE.ref] });
const NOTED = stubSupport({ id: "noted", cost: 0, abilities: [NOTED_RESPONSE.ref] });
const PLUS = stubSupport({ id: "plus", cost: 0, abilities: [PLUS_RESPONSE.ref] });
const EITHER_CARD = stubSupport({ id: "either-card", cost: 0, abilities: [EITHER_CARD_RESPONSE.ref] });
const PICKED = stubSupport({ id: "picked", cost: 0, abilities: [PICKED_RESPONSE.ref] });
const GROUP_CHOICE = stubSupport({ id: "group-choice", cost: 0, abilities: [GROUP_CHOICE_RESPONSE.ref] });
const OTHERS = stubSupport({ id: "others", cost: 0, abilities: [OTHERS_RESPONSE.ref] });
const NESTED = stubSupport({ id: "nested", cost: 0, abilities: [NESTED_RESPONSE.ref] });
const FIRST_ONLY = stubSupport({ id: "first-only", cost: 0, abilities: [FIRST_ONLY_RESPONSE.ref] });
const WHOLE_GROUP = stubSupport({ id: "whole-group", cost: 0, abilities: [WHOLE_GROUP_RESPONSE.ref] });
const PICKED_IF = stubSupport({ id: "picked-if", cost: 0, abilities: [PICKED_IF_RESPONSE.ref] });
const BATCH = stubSupport({ id: "batch", cost: 0, abilities: [BATCH_RESPONSE.ref] });
const METER = stubSupport({ id: "meter", cost: 0 });
const GUARD = stubAlly({ id: "guard", cost: 0, atk: 1, thw: 1, hp: 2 });

const meter: TargetRef = { kind: "named", name: METER.name };
const slot = (name: string): CardSelector => ({ kind: "ref", ref: { kind: "slot", slot: name } });
const topOfDeck = (n: number): CardSelector => ({ kind: "zone", zone: "deck", player: you, top: constant(n) });
const measure = (counterType: string, name: string): EffectSpec => ({
  kind: "addCounters",
  target: meter,
  counterType,
  amount: { kind: "var", name },
});
/** Reads the bound set after the responses: its count and wild icons onto `meter`, its cards to the set-aside area. */
const readSet = (name: string): readonly EffectSpec[] => [
  measure("count", `${name}.count`),
  measure("wild", `${name}.wild`),
  { kind: "moveCards", cards: slot(name), to: "setAside" },
];
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const mill = (n: number) =>
  event(`mill-${n}`, [{ kind: "moveCards", cards: topOfDeck(n), to: "discard", bind: "milled" }, ...readSet("milled")]);
const MILL_1 = mill(1);
const MILL_3 = mill(3);
const MILL_5 = mill(5);
// "Discard cards from the top of your deck until you discard a [justice] card."
const UNTIL = event("until", [
  { kind: "discardDeckUntil", player: you, filter: { aspect: "justice" }, bind: "found" },
  measure("count", "found.count"),
]);
// Discards that are not from a player's deck: from the hand, from play, from the encounter deck.
const ELSEWHERE = event("elsewhere", [
  { kind: "moveCards", cards: { kind: "zone", zone: "hand", player: you, filter: { name: HAND.name } }, to: "discard" },
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "named", name: GUARD.name } }, to: "discard" },
  { kind: "discardEncounterCards", count: constant(2) },
]);
// A mission attempt's wording: a card a response takes away does not count (April 30, 2026 - Ruling 4, answer 1).
const ATTEMPT = event("attempt", [
  { kind: "moveCards", cards: topOfDeck(3), to: "discard", bind: "milled", takenAwayNotCounted: true },
  ...readSet("milled"),
]);
const EVENTS = [MILL_1, MILL_3, MILL_5, UNTIL, ELSEWHERE, ATTEMPT];
// "Action: Discard the top 2 cards of your deck → …", the discarded cards bound for its effects.
const COSTLY_ACTION = stubAbility(
  "costly.action",
  def({
    trigger: { kind: "action" },
    cost: { discardFromDeck: 2, discardFromDeckSlot: "paid" },
    effects: [
      {
        kind: "addCounters",
        target: meter,
        counterType: "count",
        amount: { kind: "refCount", of: { kind: "slot", slot: "paid" } },
      },
      { kind: "moveCards", cards: slot("paid"), to: "setAside" },
    ],
  }),
);
const COSTLY = stubUpgrade({ id: "costly", cost: 0, abilities: [COSTLY_ACTION.ref] });
// An encounter card: "When Revealed: Discard the top 5 cards of your deck."
const DRAIN_REVEALED = stubAbility(
  "drain.when-revealed",
  def({ trigger: { kind: "whenRevealed" }, effects: [{ kind: "moveCards", cards: topOfDeck(5), to: "discard" }] }),
);
const DRAIN = stubTreachery({ id: "drain", boostIcons: 0, abilities: [DRAIN_REVEALED.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const ACTIONS = [...EVENTS.map((e) => e.ability), COSTLY_ACTION, DRAIN_REVEALED];
const deps: EngineDeps = depsOf(
  BACK_RESPONSE,
  HAND_RESPONSE,
  FOX_RESPONSE,
  LADY_RESPONSE,
  TALLY_RESPONSE,
  TICK_RESPONSE,
  MIXED_RESPONSE,
  GROUP_RESPONSE,
  RELAY_RESPONSE,
  MISSED_RESPONSE,
  THERE_RESPONSE,
  EITHER_RESPONSE,
  GRAB_RESPONSE,
  PIN_RESPONSE,
  NOTED_RESPONSE,
  PLUS_RESPONSE,
  EITHER_CARD_RESPONSE,
  PICKED_RESPONSE,
  GROUP_CHOICE_RESPONSE,
  OTHERS_RESPONSE,
  NESTED_RESPONSE,
  FIRST_ONLY_RESPONSE,
  WHOLE_GROUP_RESPONSE,
  PICKED_IF_RESPONSE,
  BATCH_RESPONSE,
  ...ACTIONS,
);
/** The same cards with no ability that hears a deck discard. */
const silentDeps: EngineDeps = depsOf(...ACTIONS);

type Name = "filler" | "match" | "back" | "hand" | "fox";
type InPlay =
  | "lady"
  | "tally"
  | "tick"
  | "mixed"
  | "group"
  | "relay"
  | "missed"
  | "there"
  | "either"
  | "grab"
  | "pin"
  | "noted"
  | "plus"
  | "either-card"
  | "picked"
  | "group-choice"
  | "others"
  | "nested"
  | "first-only"
  | "whole-group"
  | "picked-if"
  | "batch"
  | "costly"
  | "guard";
interface Table {
  readonly state: GameState;
  /** The deck's top cards, in order. */
  readonly top: readonly InstanceId[];
  readonly inPlay: Readonly<Record<string, InstanceId>>;
}

/**
 * p1 in hero form with `inPlay` (and the meter) in play; the deck is `top` (in order) then `rest` fillers, the discard
 * pile `discard` fillers; every other card p1 owns is in hand (surgery before the session starts).
 */
function start(
  top: readonly Name[],
  options: {
    readonly rest?: number;
    readonly discard?: number;
    readonly inPlay?: readonly InPlay[];
    readonly using?: EngineDeps;
  } = {},
): Table {
  const base = gameAtFirstTurn({
    deps: options.using ?? deps,
    cards: [
      FILLER,
      MATCH,
      BACK,
      HAND,
      FOX,
      LADY,
      TALLY,
      TICK,
      MIXED,
      GROUP,
      RELAY,
      MISSED,
      THERE,
      EITHER,
      GRAB,
      PIN,
      NOTED,
      PLUS,
      EITHER_CARD,
      PICKED,
      GROUP_CHOICE,
      OTHERS,
      NESTED,
      FIRST_ONLY,
      WHOLE_GROUP,
      PICKED_IF,
      BATCH,
      METER,
      GUARD,
      COSTLY,
      DRAIN,
      BLANK,
      ...EVENTS.map((e) => e.card),
    ],
    encounter: [DRAIN.id, ...copiesOf(BLANK.id, 30)],
    deck: [
      ...copiesOf(FILLER.id, 12),
      ...copiesOf(MATCH.id, 2),
      ...copiesOf(BACK.id, 2),
      ...copiesOf(HAND.id, 3),
      ...copiesOf(FOX.id, 2),
      LADY.id,
      TALLY.id,
      TICK.id,
      MIXED.id,
      GROUP.id,
      RELAY.id,
      MISSED.id,
      THERE.id,
      EITHER.id,
      GRAB.id,
      PIN.id,
      NOTED.id,
      PLUS.id,
      EITHER_CARD.id,
      PICKED.id,
      GROUP_CHOICE.id,
      OTHERS.id,
      NESTED.id,
      FIRST_ONLY.id,
      WHOLE_GROUP.id,
      PICKED_IF.id,
      BATCH.id,
      METER.id,
      GUARD.id,
      COSTLY.id,
      ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    ],
  });
  const seat = mustPlayer(base, P1);
  const pool = [...seat.hand, ...seat.deck, ...seat.discard];
  const taken = new Set<InstanceId>();
  const take = (cardId: string): InstanceId => {
    const id = pool.find((candidate) => !taken.has(candidate) && base.instances[candidate]?.cardId === cardId);
    if (!id) throw new Error(`no ${cardId} copy left`);
    taken.add(id);
    return id;
  };
  const topIds = top.map(take);
  const restIds = Array.from({ length: options.rest ?? 6 }, () => take(FILLER.id));
  const discardIds = Array.from({ length: options.discard ?? 0 }, () => take(FILLER.id));
  const inPlay: Record<string, InstanceId> = {};
  for (const name of ["meter", ...(options.inPlay ?? [])]) inPlay[name] = take(name);
  const played = Object.values(inPlay);
  const instances = { ...base.instances };
  for (const id of played) instances[id] = { ...mustInstance(base, id), controllerId: P1, faceup: true };
  const villain = base.villains[0]!.instanceId;
  // A stunned villain's attack is cancelled before a boost card is dealt, so the encounter deck's top card is the one
  // dealt to p1.
  instances[villain] = { ...instances[villain]!, statuses: { ...instances[villain]!.statuses, stunned: 1 } };
  const state: GameState = {
    ...base,
    instances,
    players: base.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: pool.filter((id) => !taken.has(id)),
            deck: [...topIds, ...restIds],
            discard: discardIds,
            playArea: [...p.playArea, ...played],
            identity: { ...p.identity, form: "hero" as const },
          }
        : p,
    ),
  };
  return { state, top: topIds, inPlay };
}

type Pick = (state: GameState) => readonly string[];
/** Triggers the optional responses of these abilities, in this order, whenever they are offered; else the default. */
const triggering =
  (...abilities: readonly StubAbility[]): Pick =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
    return abilities.flatMap((ability) =>
      choice.options
        .filter((option) => option.ref.kind === "ability" && option.ref.abilityId === ability.ref.id)
        .map((option) => option.optionId),
    );
  };

/** The table with the main scheme holding `threat`. */
const withThreat = (table: Table, scheme: InstanceId, threat: number): Table => ({
  ...table,
  state: {
    ...table.state,
    instances: { ...table.state.instances, [scheme]: { ...mustInstance(table.state, scheme), threat } },
  },
});
function run(table: Table, pick: Pick, command: Command, using: EngineDeps = deps) {
  return runCommandsPicking(table.state, using, pick, command);
}
function play(table: Table, card: { readonly card: { readonly id: string } }, pick: Pick = defaultPick, using = deps) {
  const id = mustPlayer(table.state, P1).hand.find((held) => table.state.instances[held]?.cardId === card.card.id);
  if (!id) throw new Error(`no ${card.card.id} in hand`);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  };
  return { ...run(table, pick, command, using), played: id };
}
function expectReplays(result: ReturnType<typeof run>, using: EngineDeps = deps): void {
  const replayed = replay(result.session.log, using);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

const heardDiscards = (events: readonly GameEvent[]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "cardDiscardedFromDeck" ? [e.event] : [],
  );
const logged = (events: readonly GameEvent[]) => events.flatMap((e) => (e.type === "cardDiscardedFromDeck" ? [e] : []));
const notCounted = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "deckDiscardNotCounted" ? [e.instanceId] : []));
const stillCounted = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "deckDiscardStillCounted" ? [e.instanceId] : []));
/** The response windows opened for deck discards, each as its candidates' ability ids. */
/** The response windows that answer a discard from a deck: as their own event or as one sharing the window. */
const windows = (events: readonly GameEvent[]): readonly (readonly string[])[] =>
  events.flatMap((e) =>
    e.type === "windowOpened" &&
    e.timing === "response" &&
    [e.event, ...(e.alsoEvents ?? [])].some((each) => each.kind === "cardDiscardedFromDeck")
      ? [e.candidates.map((c) => `${c.abilityId}`)]
      : [],
  );
const resolved = (events: readonly GameEvent[], ability: StubAbility): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "abilityResolved" && e.abilityId === ability.ref.id ? [e.instanceId] : []));
const shuffles = (events: readonly GameEvent[]): number =>
  events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "deck").length;
const seat = (state: GameState) => mustPlayer(state, P1);
const counters = (state: GameState, id: InstanceId | undefined, type: string): number =>
  (id ? mustInstance(state, id).counters[type] : undefined) ?? 0;
/** `cause`: the side of the discarding card and effect or cost (issue #922). */
const discarded = (
  id: InstanceId | undefined,
  by: InstanceId,
  at: "discard" | "deck" = "discard",
  cause: { readonly by: "playerCard" | "encounterCard"; readonly how: "effect" | "cost" } = {
    by: "playerCard",
    how: "effect",
  },
): TriggerEvent => ({
  kind: "cardDiscardedFromDeck",
  instanceId: id!,
  playerId: P1,
  deck: "player",
  fromTop: true,
  sourceInstanceId: by,
  at,
  ...cause,
});

describe("`EventPattern.together`: 'after you discard cards' answers the whole discard once", () => {
  it("two matching cards of one discard: one candidate, one resolution, both cards in its slot", () => {
    const table = start(["match", "filler", "match"], { inPlay: ["batch", "tally"] });
    const result = play(table, MILL_3);
    // The per-card ability is a candidate for each of the three; the batch one once, for its two [justice] cards.
    const [candidates] = windows(result.events);
    expect(candidates?.filter((id) => id === BATCH_RESPONSE.ref.id)).toHaveLength(1);
    expect(candidates?.filter((id) => id === TALLY_RESPONSE.ref.id)).toHaveLength(3);
    expect(resolved(result.events, BATCH_RESPONSE)).toHaveLength(1);
    expect(counters(result.state, table.inPlay.batch, "answers")).toBe(1);
    expect(counters(result.state, table.inPlay.batch, "cards")).toBe(2);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(3);
    expectReplays(result);
  });

  it("one matching card is a batch of one, and none is no answer", () => {
    const one = start(["filler", "match", "filler"], { inPlay: ["batch"] });
    const single = play(one, MILL_3);
    expect(counters(single.state, one.inPlay.batch, "answers")).toBe(1);
    expect(counters(single.state, one.inPlay.batch, "cards")).toBe(1);
    const none = start(["filler", "filler", "filler"], { inPlay: ["batch"] });
    const silent = play(none, MILL_3);
    expect(resolved(silent.events, BATCH_RESPONSE)).toEqual([]);
    expect(counters(silent.state, none.inPlay.batch, "answers")).toBe(0);
  });
});

describe("§3.55 every discard from a player's deck is announced once per card (§4.1 Q31)", () => {
  it("a player card's effect: one event per card in discard order, in one shared window, and a log line each", () => {
    const table = start(["filler", "match", "filler"], { inPlay: ["tally"] });
    const result = play(table, MILL_3);
    const [first, second, third] = table.top;
    expect(heardDiscards(result.events)).toEqual([
      discarded(first, result.played),
      discarded(second, result.played),
      discarded(third, result.played),
    ]);
    expect(logged(result.events)).toEqual(
      table.top.map((instanceId) => ({
        type: "cardDiscardedFromDeck",
        playerId: P1,
        instanceId,
        by: result.played,
        at: "discard",
      })),
    );
    // One window for the three conditions of the one effect (RRG 1.8 "Triggering Condition", p. 45).
    expect(windows(result.events)).toEqual([Array.from({ length: 3 }, () => TALLY_RESPONSE.ref.id)]);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(3);
    // Nothing answered them by moving a card: all three are still the cards "discarded this way".
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(3);
    expect(seat(result.state).setAside).toEqual(expect.arrayContaining([...table.top]));
    expect(notCounted(result.events)).toEqual([]);
    expectReplays(result);
  });

  it("a 'discard the top 2 cards of your deck →' cost: one event per card, discarded by the card whose cost it is", () => {
    const table = start(["filler", "filler", "filler"], { inPlay: ["tally", "costly"] });
    const costly = table.inPlay.costly!;
    const result = run(table, defaultPick, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: costly,
      abilityId: COSTLY_ACTION.ref.id,
      payment: [],
    });
    expect(heardDiscards(result.events)).toEqual([
      discarded(table.top[0], costly, "discard", { by: "playerCard", how: "cost" }),
      discarded(table.top[1], costly, "discard", { by: "playerCard", how: "cost" }),
    ]);
    expect(windows(result.events)).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(2);
    expect(seat(result.state).deck[0]).toBe(table.top[2]);
    expectReplays(result);
  });

  it("an encounter card's 'discard the top 5 cards of your deck': five events, whoever's card it is", () => {
    const table = start(["filler", "filler", "filler", "filler", "filler"], { inPlay: ["tally"] });
    const state = onTopOfEncounterDeck(table.state, DRAIN.id);
    const drain = state.encounterDecks[state.encounterDeckOrder[0]!]!.deck[0]!;
    const result = run({ ...table, state }, defaultPick, { type: "endTurn", playerId: P1 });
    expect(heardDiscards(result.events)).toEqual(
      table.top.map((id) => discarded(id, drain, "discard", { by: "encounterCard", how: "effect" })),
    );
    // Still one window, now the end-of-reveal one the discards' responses wait for, shared with "after this card is
    // revealed" (RRG v1.8 p.38; owner decision 2026-10-16 (audit finding 18)).
    const held = result.events.filter(
      (e) =>
        e.type === "windowOpened" &&
        e.timing === "response" &&
        e.event.kind === "cardRevealed" &&
        (e.alsoEvents ?? []).filter((each) => each.kind === "cardDiscardedFromDeck").length === 5,
    );
    expect(held).toHaveLength(1);
    expect(windows(result.events)).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(5);
    expectReplays(result);
  });

  it("a 'discard until' loop: each card passed over and the match, and no card after it", () => {
    const table = start(["filler", "filler", "match", "filler"], { inPlay: ["tally"] });
    const result = play(table, UNTIL);
    expect(heardDiscards(result.events)).toEqual(table.top.slice(0, 3).map((id) => discarded(id, result.played)));
    expect(windows(result.events)).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(3);
    expect(seat(result.state).deck[0]).toBe(table.top[3]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
    expectReplays(result);
  });

  it("a discard from the hand, from play or from the encounter deck is not one, and the card's response stays off", () => {
    const table = start(["filler"], { inPlay: ["tally", "lady", "guard"] });
    const held = seat(table.state).hand.filter((id) => table.state.instances[id]?.cardId === HAND.id);
    expect(held.length).toBeGreaterThan(0);
    const result = play(table, ELSEWHERE, triggering(HAND_RESPONSE, LADY_RESPONSE));
    expect(heardDiscards(result.events)).toEqual([]);
    expect(logged(result.events)).toEqual([]);
    expect(windows(result.events)).toEqual([]);
    expect(seat(result.state).discard).toEqual(expect.arrayContaining([...held, table.inPlay.guard!]));
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(0);
    expect(mustInstance(result.state, table.inPlay.lady!).attachments).toEqual([]);
    expectReplays(result);
  });
});

describe("§3.55 the discarded card answers from the discard pile (activeIn: discard)", () => {
  it("is optional and offered to the card's owner; declined, the card stays in the discard pile", () => {
    const table = start(["hand"]);
    let asked: string | undefined;
    const result = play(table, MILL_1, (state) => {
      if (state.pendingChoice?.prompt.kind === "chooseTriggers") asked = state.pendingChoice.playerId;
      return defaultPick(state);
    });
    expect(asked).toBe(P1);
    expect(windows(result.events)).toEqual([[HAND_RESPONSE.ref.id]]);
    expect(resolved(result.events, HAND_RESPONSE)).toEqual([]);
    // Left where it was, it is still one of the cards discarded this way.
    expect(seat(result.state).setAside).toEqual([table.top[0]]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
  });

  it("'shuffle it back into your deck' takes it from the discard pile into a shuffled deck", () => {
    const table = start(["back", "filler"]);
    const result = play(table, MILL_1, triggering(BACK_RESPONSE));
    expect(resolved(result.events, BACK_RESPONSE)).toEqual([table.top[0]]);
    expect(seat(result.state).deck).toContain(table.top[0]);
    expect(seat(result.state).deck).toHaveLength(8);
    expect(seat(result.state).discard).not.toContain(table.top[0]);
    expect(shuffles(result.events)).toBe(1);
    expectReplays(result);
  });

  it("'add it to your hand' takes it from the discard pile", () => {
    const table = start(["hand", "filler"]);
    const result = play(table, MILL_1, triggering(HAND_RESPONSE));
    expect(seat(result.state).hand).toContain(table.top[0]);
    expect(seat(result.state).discard).not.toContain(table.top[0]);
    expectReplays(result);
  });

  it("'put it into play under your control' takes it from the discard pile", () => {
    const table = start(["fox", "filler"]);
    const result = play(table, MILL_1, triggering(FOX_RESPONSE));
    const fox = table.top[0]!;
    expect(seat(result.state).playArea).toContain(fox);
    expect(mustInstance(result.state, fox)).toMatchObject({ controllerId: P1, faceup: true });
    expect(seat(result.state).discard).not.toContain(fox);
    expectReplays(result);
  });

  it("two such cards discarded by one effect are offered together, and each answers its own discard", () => {
    const table = start(["hand", "filler", "hand"]);
    const result = play(table, MILL_3, triggering(HAND_RESPONSE));
    expect(windows(result.events)).toEqual([[HAND_RESPONSE.ref.id, HAND_RESPONSE.ref.id]]);
    expect(resolved(result.events, HAND_RESPONSE)).toEqual([table.top[0], table.top[2]]);
    expect(seat(result.state).hand).toEqual(expect.arrayContaining([table.top[0], table.top[2]]));
    expectReplays(result);
  });
});

describe("§3.55 'attach that card facedown here (to a maximum of 3)'", () => {
  const attached = (state: GameState, table: Table) => mustInstance(state, table.inPlay.lady!).attachments;

  it("attaches each card discarded from your deck facedown, out of the discard pile", () => {
    const table = start(["filler", "match", "filler"], { inPlay: ["lady"] });
    const result = play(table, MILL_3, triggering(LADY_RESPONSE));
    expect([...attached(result.state, table)].sort()).toEqual([...table.top].sort());
    for (const id of table.top) expect(mustInstance(result.state, id).faceup).toBe(false);
    expect(seat(result.state).discard.filter((id) => table.top.includes(id))).toEqual([]);
    expectReplays(result);
  });

  it("stops at 3: a fourth and fifth card of the same effect stay in the discard pile", () => {
    const table = start(["filler", "filler", "filler", "filler", "filler"], { inPlay: ["lady"] });
    const result = play(table, MILL_5, triggering(LADY_RESPONSE));
    expect(attached(result.state, table)).toHaveLength(3);
    expect(seat(result.state).setAside).toHaveLength(2);
    expectReplays(result);
  });

  it("holding 3, it is not offered a later discard", () => {
    const table = start(["filler", "filler", "filler", "filler"], { inPlay: ["lady"] });
    const first = play(table, MILL_3, triggering(LADY_RESPONSE));
    const second = play({ ...table, state: first.state }, MILL_1, triggering(LADY_RESPONSE));
    expect(windows(second.events)).toEqual([]);
    expect(attached(second.state, table)).toHaveLength(3);
  });

  it("the card's own response first leaves it nothing to act on, and the other way round", () => {
    const table = start(["hand", "filler"], { inPlay: ["lady"] });
    const hand = table.top[0]!;
    const own = play(table, MILL_1, triggering(HAND_RESPONSE, LADY_RESPONSE));
    expect(seat(own.state).hand).toContain(hand);
    expect(resolved(own.events, LADY_RESPONSE)).toEqual([]);
    expect(attached(own.state, table)).toEqual([]);
    const lady = play(table, MILL_1, triggering(LADY_RESPONSE, HAND_RESPONSE));
    expect(attached(lady.state, table)).toEqual([hand]);
    expect(resolved(lady.events, HAND_RESPONSE)).toEqual([]);
    expect(seat(lady.state).hand).not.toContain(hand);
    expectReplays(own);
    expectReplays(lady);
  });
});

describe("issue #928: a response that needs nothing of the discarded card stays offered once another moved it", () => {
  it("picked with the card's own 'add it to your hand': both resolve, the card in hand and the counter placed", () => {
    const table = start(["hand", "filler"], { inPlay: ["tick"] });
    const card = table.top[0]!;
    const result = play(table, MILL_1, triggering(HAND_RESPONSE, TICK_RESPONSE));
    expect(seat(result.state).hand).toContain(card);
    expect(resolved(result.events, TICK_RESPONSE)).toEqual([table.inPlay.tick]);
    expect(counters(result.state, table.inPlay.tick, "seen")).toBe(1);
    expectReplays(result);
  });

  it("offered again after the card's own response took the card, and resolves", () => {
    const table = start(["hand", "filler"], { inPlay: ["tick"] });
    const card = table.top[0]!;
    // The card's own response alone first; the counter's is picked when the window offers the rest again.
    let round = 0;
    const pick: Pick = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(state);
      round += 1;
      return triggering(round === 1 ? HAND_RESPONSE : TICK_RESPONSE)(state);
    };
    const result = play(table, MILL_1, pick);
    expect(round).toBe(2);
    expect(seat(result.state).hand).toContain(card);
    expect(counters(result.state, table.inPlay.tick, "seen")).toBe(1);
    expectReplays(result);
  });

  it("one with a part of its own resolves it, and its 'that card' does not follow the card into the hand", () => {
    const table = start(["hand", "filler"], { inPlay: ["mixed"] });
    const card = table.top[0]!;
    const result = play(table, MILL_1, triggering(HAND_RESPONSE, MIXED_RESPONSE));
    expect(resolved(result.events, MIXED_RESPONSE)).toEqual([table.inPlay.mixed]);
    expect(counters(result.state, table.inPlay.mixed, "seen")).toBe(1);
    expect(seat(result.state).hand).toContain(card);
    expect(mustInstance(result.state, table.inPlay.mixed!).attachments).toEqual([]);
    expectReplays(result);
  });

  it("a 'together' answer kept that way does not follow the cards either, and keeps those still there", () => {
    const table = start(["hand", "filler", "filler"], { inPlay: ["group"] });
    const [card, ...rest] = table.top;
    const result = play(table, MILL_3, triggering(HAND_RESPONSE, GROUP_RESPONSE));
    expect(seat(result.state).hand).toContain(card);
    expect(counters(result.state, table.inPlay.group, "seen")).toBe(1);
    expect([...mustInstance(result.state, table.inPlay.group!).attachments].sort()).toEqual([...rest].sort());
    expectReplays(result);
  });

  it("a response that moves the card itself still names it in its next instruction", () => {
    const table = start(["filler", "filler"], { inPlay: ["relay"] });
    const card = table.top[0]!;
    const result = play(table, MILL_1, triggering(RELAY_RESPONSE));
    expect(seat(result.state).setAside).toContain(card);
    expect(seat(result.state).hand).not.toContain(card);
    expectReplays(result);
  });

  it("one initiated after another response moved the card does not follow it", () => {
    const table = start(["hand", "filler"], { inPlay: ["relay"] });
    const card = table.top[0]!;
    const result = play(table, MILL_1, triggering(HAND_RESPONSE, RELAY_RESPONSE));
    expect(resolved(result.events, RELAY_RESPONSE)).toEqual([]);
    expect(seat(result.state).hand).toContain(card);
    expectReplays(result);
  });

  it("once it moved, 'if that card is not there' resolves and 'if it is' is dropped", () => {
    const table = start(["hand", "filler"], { inPlay: ["missed", "there"] });
    const result = play(table, MILL_1, triggering(HAND_RESPONSE, MISSED_RESPONSE, THERE_RESPONSE));
    expect(counters(result.state, table.inPlay.missed, "seen")).toBe(1);
    expect(resolved(result.events, THERE_RESPONSE)).toEqual([]);
    expect(counters(result.state, table.inPlay.there, "seen")).toBe(0);
    expectReplays(result);
  });

  it("a 'choose one' is offered while its other option can still be chosen, and not once neither can", () => {
    const table = start(["hand", "filler"], { inPlay: ["either"] });
    const scheme = table.state.mainScheme!.instanceId;
    // Records the options of each "choose one" asked; otherwise picks as `triggering` does.
    const asked: string[][] = [];
    const pick: Pick = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") asked.push(choice.options.map((option) => `${option.label}`));
      return triggering(HAND_RESPONSE, EITHER_RESPONSE)(state);
    };
    const kept = play(withThreat(table, scheme, 3), MILL_1, pick);
    expect(resolved(kept.events, EITHER_RESPONSE)).toEqual([table.inPlay.either]);
    // "Attach that card" is not offered: the only option left resolves, and the threat is removed.
    expect(asked.flat()).not.toContain("attach");
    expect(mustInstance(kept.state, scheme).threat).toBe(2);
    expect(mustInstance(kept.state, table.inPlay.either!).attachments).toEqual([]);
    // No threat on the main scheme: the removal has no target, and "that card" has gone.
    const dropped = play(withThreat(table, scheme, 0), MILL_1, triggering(HAND_RESPONSE, EITHER_RESPONSE));
    expect(resolved(dropped.events, EITHER_RESPONSE)).toEqual([]);
    expectReplays(kept);
    expectReplays(dropped);
  });

  it("an option on an earlier choice among that card is not offered once it moved", () => {
    const table = start(["hand", "filler"], { inPlay: ["picked"] });
    const scheme = table.state.mainScheme!.instanceId;
    const asked: string[][] = [];
    const pick: Pick = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") asked.push(choice.options.map((option) => `${option.label}`));
      return triggering(HAND_RESPONSE, PICKED_RESPONSE)(state);
    };
    const result = play(withThreat(table, scheme, 3), MILL_1, pick);
    expect(resolved(result.events, PICKED_RESPONSE)).toEqual([table.inPlay.picked]);
    expect(asked.flat()).not.toContain("attach");
    expect(mustInstance(result.state, scheme).threat).toBe(2);
    expectReplays(result);
  });

  it("a 'together' choose-one keeps its option on the cards still there, and drops it once none is", () => {
    const table = start(["hand", "filler", "filler"], { inPlay: ["group-choice"] });
    const scheme = table.state.mainScheme!.instanceId;
    const [, ...rest] = table.top;
    const askedIn = (prefer: string) => {
      const asked: string[][] = [];
      const pick: Pick = (state) => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseOption") {
          asked.push(choice.options.map((option) => `${option.label}`));
          const wanted = choice.options.find((option) => option.label === prefer) ?? choice.options[0]!;
          return [wanted.optionId];
        }
        return triggering(HAND_RESPONSE, GROUP_CHOICE_RESPONSE)(state);
      };
      return { asked, pick };
    };
    // Partly gone: two cards of the three are still in the pile, and "attach" takes them.
    const partly = askedIn("attach");
    const kept = play(withThreat(table, scheme, 3), MILL_3, partly.pick);
    expect(partly.asked.flat()).toContain("attach");
    expect([...mustInstance(kept.state, table.inPlay["group-choice"]!).attachments].sort()).toEqual([...rest].sort());
    // Wholly gone: the only card discarded was taken, so only the removal is offered.
    const alone = start(["hand", "filler"], { inPlay: ["group-choice"] });
    const wholly = askedIn("attach");
    const gone = play(withThreat(alone, alone.state.mainScheme!.instanceId, 3), MILL_1, wholly.pick);
    expect(wholly.asked.flat()).not.toContain("attach");
    expect(mustInstance(gone.state, alone.state.mainScheme!.instanceId).threat).toBe(2);
    expectReplays(kept);
    expectReplays(gone);
  });

  it("an exclusion of that card is no operand: 'each other support' still gets its counter", () => {
    const table = start(["hand", "filler"], { inPlay: ["others"] });
    const result = play(table, MILL_1, triggering(HAND_RESPONSE, OTHERS_RESPONSE));
    expect(resolved(result.events, OTHERS_RESPONSE)).toEqual([table.inPlay.others]);
    expect(counters(result.state, table.inPlay.others, "seen")).toBe(1);
    expectReplays(result);
  });

  it("an option whose branch can no longer run is not offered beside one that can", () => {
    const table = start(["hand", "filler"], { inPlay: ["nested"] });
    const scheme = table.state.mainScheme!.instanceId;
    const asked: string[][] = [];
    const pick: Pick = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") asked.push(choice.options.map((option) => `${option.label}`));
      return triggering(HAND_RESPONSE, NESTED_RESPONSE)(state);
    };
    const result = play(withThreat(table, scheme, 3), MILL_1, pick);
    expect(asked.flat()).not.toContain("draw");
    expect(mustInstance(result.state, scheme).threat).toBe(2);
    expectReplays(result);
  });

  it("a paid 'together' answer on the first card alone is not initiated once it moved; one on the group is", () => {
    const table = start(["hand", "filler", "filler"], { inPlay: ["first-only", "whole-group"] });
    const [, ...rest] = table.top;
    const result = play(table, MILL_3, triggering(HAND_RESPONSE, FIRST_ONLY_RESPONSE, WHOLE_GROUP_RESPONSE));
    // Not initiated, so not paid: the card stays ready.
    expect(resolved(result.events, FIRST_ONLY_RESPONSE)).toEqual([]);
    expect(mustInstance(result.state, table.inPlay["first-only"]!).exhausted).toBe(false);
    expect(resolved(result.events, WHOLE_GROUP_RESPONSE)).toEqual([table.inPlay["whole-group"]]);
    expect([...mustInstance(result.state, table.inPlay["whole-group"]!).attachments].sort()).toEqual([...rest].sort());
    expectReplays(result);
  });

  it("an option on a condition over an earlier, now empty, choice is not offered", () => {
    const table = start(["hand", "filler"], { inPlay: ["picked-if"] });
    const scheme = table.state.mainScheme!.instanceId;
    const asked: string[][] = [];
    const pick: Pick = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") asked.push(choice.options.map((option) => `${option.label}`));
      return triggering(HAND_RESPONSE, PICKED_IF_RESPONSE)(state);
    };
    const result = play(withThreat(table, scheme, 3), MILL_1, pick);
    expect(asked.flat()).not.toContain("draw");
    expect(mustInstance(result.state, scheme).threat).toBe(2);
    expectReplays(result);
  });

  it("a var set for later effects is no part of its own: with no threat to remove, nothing is left", () => {
    const table = start(["hand", "filler"], { inPlay: ["noted"] });
    const scheme = table.state.mainScheme!.instanceId;
    const dropped = play(withThreat(table, scheme, 0), MILL_1, triggering(HAND_RESPONSE, NOTED_RESPONSE));
    expect(resolved(dropped.events, NOTED_RESPONSE)).toEqual([]);
    const kept = play(withThreat(table, scheme, 3), MILL_1, triggering(HAND_RESPONSE, NOTED_RESPONSE));
    expect(mustInstance(kept.state, scheme).threat).toBe(2);
    expectReplays(dropped);
  });

  it("an amount read from that card counts nothing once it has gone: 1 plus its cost puts 1 counter", () => {
    const table = start(["hand", "filler"], { inPlay: ["plus"] });
    const result = play(table, MILL_1, triggering(HAND_RESPONSE, PLUS_RESPONSE));
    expect(counters(result.state, table.inPlay.plus, "seen")).toBe(1);
    expectReplays(result);
  });

  it("a union with another source still moves that other card", () => {
    const table = start(["hand", "filler"], { discard: 1, inPlay: ["either-card"] });
    const before = seat(table.state).discard[0]!;
    const result = play(table, MILL_1, triggering(HAND_RESPONSE, EITHER_CARD_RESPONSE));
    expect(resolved(result.events, EITHER_CARD_RESPONSE)).toEqual([table.inPlay["either-card"]]);
    expect(seat(result.state).setAside).toContain(before);
    expect(seat(result.state).hand).toContain(table.top[0]);
    expectReplays(result);
  });

  it("two forced responses on that card: once the first moved it, the second does not initiate", () => {
    // RRG 1.8 "Forced" (p. 20): a forced ability with no valid target does not initiate.
    const table = start(["filler", "filler"], { inPlay: ["grab", "pin"] });
    const card = table.top[0]!;
    const result = play(table, MILL_1);
    const ran = [...resolved(result.events, GRAB_RESPONSE), ...resolved(result.events, PIN_RESPONSE)];
    expect(ran).toHaveLength(1);
    const inHand = seat(result.state).hand.includes(card);
    const pinned = mustInstance(result.state, table.inPlay.pin!).attachments.includes(card);
    expect(inHand !== pinned).toBe(true);
    expectReplays(result);
  });

  it("'attach that card facedown here' still is not, beside one that is (the card it needs is gone)", () => {
    const table = start(["hand", "filler"], { inPlay: ["lady", "tick"] });
    const result = play(table, MILL_1, triggering(HAND_RESPONSE, LADY_RESPONSE, TICK_RESPONSE));
    expect(resolved(result.events, LADY_RESPONSE)).toEqual([]);
    expect(mustInstance(result.state, table.inPlay.lady!).attachments).toEqual([]);
    expect(counters(result.state, table.inPlay.tick, "seen")).toBe(1);
    expectReplays(result);
  });
});

describe("§4.1 Q32 = A: a card a response took away still counts for the ability that discarded it, but is out of its set", () => {
  it("an effect's bound set drops the cards taken to hand and shuffled back, but its totals still count them", () => {
    const table = start(["hand", "filler", "back"]);
    const [hand, filler, back] = table.top;
    const result = play(table, MILL_3, triggering(HAND_RESPONSE, BACK_RESPONSE));
    expect(seat(result.state).setAside).toEqual([filler]);
    // The totals keep what the discard gave: `filler` prints no icon, the two resource cards 1 wild each.
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(3);
    expect(counters(result.state, table.inPlay.meter, "wild")).toBe(2);
    // Out of the set: the effect that moves "them" to set aside did not reach the two taken away again.
    expect(stillCounted(result.events)).toEqual([hand, back]);
    expect(notCounted(result.events)).toEqual([]);
    expect(seat(result.state).hand).toContain(hand);
    expect(seat(result.state).deck).toContain(back);
    expectReplays(result);
  });

  it("with no response used, every card discarded is counted, icons included", () => {
    const table = start(["hand", "filler", "back"]);
    const result = play(table, MILL_3);
    expect([...seat(result.state).setAside].sort()).toEqual([...table.top].sort());
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(3);
    expect(counters(result.state, table.inPlay.meter, "wild")).toBe(2);
    expect(notCounted(result.events)).toEqual([]);
  });

  it("a card another card's response took away still counts, and is not moved again", () => {
    const table = start(["filler", "filler"], { inPlay: ["lady"] });
    const result = play(table, MILL_1, triggering(LADY_RESPONSE));
    expect(seat(result.state).setAside).toEqual([]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
    expect(stillCounted(result.events)).toEqual([table.top[0]]);
    expect(notCounted(result.events)).toEqual([]);
  });

  it("a cost's slot drops the card before the ability's effects resolve, though it was counted", () => {
    const table = start(["hand", "filler", "filler"], { inPlay: ["costly"] });
    const result = run(table, triggering(HAND_RESPONSE), {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: table.inPlay.costly!,
      abilityId: COSTLY_ACTION.ref.id,
      payment: [],
    });
    expect(seat(result.state).hand).toContain(table.top[0]);
    expect(seat(result.state).setAside).toEqual([table.top[1]]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
    expect(stillCounted(result.events)).toEqual([table.top[0]]);
    expect(notCounted(result.events)).toEqual([]);
    expectReplays(result);
  });

  it("a 'discard until' match taken away still counts as the card found", () => {
    const found = start(["match", "filler"], { inPlay: ["lady"] });
    const result = play(found, UNTIL, triggering(LADY_RESPONSE));
    expect(mustInstance(result.state, found.inPlay.lady!).attachments).toEqual([found.top[0]]);
    expect(counters(result.state, found.inPlay.meter, "count")).toBe(1);
    expect(stillCounted(result.events)).toEqual([found.top[0]]);
    expect(notCounted(result.events)).toEqual([]);
  });
});

describe("§4.1 Q32 exception: a moveCards with takenAwayNotCounted (the mission attempt, April 30, 2026 - Ruling 4, answer 1)", () => {
  it("still drops a card a response took away from the set and from its totals", () => {
    const table = start(["hand", "filler", "back"]);
    const [hand, filler, back] = table.top;
    const result = play(table, ATTEMPT, triggering(HAND_RESPONSE, BACK_RESPONSE));
    expect(seat(result.state).setAside).toEqual([filler]);
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(1);
    expect(counters(result.state, table.inPlay.meter, "wild")).toBe(0);
    expect(notCounted(result.events)).toEqual([hand, back]);
    expect(stillCounted(result.events)).toEqual([]);
    expectReplays(result);
  });
});

describe("§4.1 Q33 = A: the deck's last card resets the deck, and the response resolves on it there", () => {
  /** The deck is one card; the discard pile holds 4 fillers, which the reset shuffles into the new deck with it. */
  const lastCard = (name: Name, inPlay: readonly InPlay[] = []) => start([name], { rest: 0, discard: 4, inPlay });

  it("the event says the reset put the card in the new deck, and the player was dealt an encounter card", () => {
    const table = lastCard("filler", ["tally"]);
    const result = play(table, MILL_1);
    expect(heardDiscards(result.events)).toEqual([discarded(table.top[0], result.played, "deck")]);
    expect(logged(result.events)).toMatchObject([{ at: "deck" }]);
    expect(seat(result.state).dealtEncounter).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(1);
    // Unanswered, it is still the card discarded this way, wherever the reset put it (docs/phase7-wave3.md §4 Q18).
    expect(seat(result.state).setAside).toEqual([table.top[0]]);
    expect(notCounted(result.events)).toEqual([]);
    expectReplays(result);
  });

  it("'add it to your hand' takes it from the new deck, with no further shuffle", () => {
    const table = lastCard("hand");
    const result = play(table, MILL_1, triggering(HAND_RESPONSE));
    expect(seat(result.state).hand).toContain(table.top[0]);
    expect(seat(result.state).deck).toHaveLength(4);
    expect(seat(result.state).discard).toEqual([result.played]);
    expect(shuffles(result.events)).toBe(1);
    expect(stillCounted(result.events)).toEqual([table.top[0]]);
    expect(notCounted(result.events)).toEqual([]);
    expectReplays(result);
  });

  it("'put it into play' takes it from the new deck, with no further shuffle", () => {
    const table = lastCard("fox");
    const result = play(table, MILL_1, triggering(FOX_RESPONSE));
    expect(seat(result.state).playArea).toContain(table.top[0]);
    expect(seat(result.state).deck).toHaveLength(4);
    expect(shuffles(result.events)).toBe(1);
    expectReplays(result);
  });

  it("'shuffle it back into your deck' is not offered: the reset has already done it (MC40 p. 21)", () => {
    const table = lastCard("back");
    const result = play(table, MILL_1, triggering(BACK_RESPONSE));
    expect(windows(result.events)).toEqual([]);
    expect(resolved(result.events, BACK_RESPONSE)).toEqual([]);
    // The discarding effect then set it aside as the card discarded this way; the reset was the only shuffle.
    expect(seat(result.state).setAside).toEqual([table.top[0]]);
    expect(shuffles(result.events)).toBe(1);
    expectReplays(result);
  });

  it("'attach that card facedown here' takes it from the new deck", () => {
    const table = lastCard("filler", ["lady"]);
    const result = play(table, MILL_1, triggering(LADY_RESPONSE));
    expect(mustInstance(result.state, table.inPlay.lady!).attachments).toEqual([table.top[0]]);
    expect(seat(result.state).deck).toHaveLength(4);
    expect(shuffles(result.events)).toBe(1);
  });
});

// Issue #810. FFG ruling, September 21, 2023, answers 2 and 4 (docs/rulings/post-rrg-1-5/05-september-2023.md): the
// responses to a discard wait until it is complete, "whether a target of the discard is found, or the deck is emptied
// by the discard", and the deck is shuffled before they resolve. A card discarded earlier in the discard that emptied
// the deck answers from where the reset put it, as the last card does (Q33 = A).
describe("§4.1 Q33 = A, extended: a card discarded before the one that emptied the deck answers from the new deck", () => {
  /** The deck holds `top` only; the discard pile 4 fillers. No [justice] card: the 'discard until' empties the deck. */
  const emptied = (top: readonly Name[], inPlay: readonly InPlay[] = []) => start(top, { rest: 0, discard: 4, inPlay });

  it("White Fox (Call for Aid's discard until): her response is offered and she enters play from the new deck", () => {
    const table = emptied(["filler", "fox", "filler"]);
    const fox = table.top[1]!;
    const result = play(table, UNTIL, triggering(FOX_RESPONSE));
    const heard = heardDiscards(result.events).find((e) => e.kind === "cardDiscardedFromDeck" && e.instanceId === fox);
    expect(heard).toEqual(discarded(fox, result.played, "deck"));
    expect(resolved(result.events, FOX_RESPONSE)).toHaveLength(1);
    expect(seat(result.state).playArea).toContain(fox);
    // The reset's 7 cards (3 discarded, 4 fillers), less White Fox; the reset was the only shuffle.
    expect(seat(result.state).deck).toHaveLength(6);
    expect(seat(result.state).deck).not.toContain(fox);
    expect(shuffles(result.events)).toBe(1);
    expectReplays(result);
  });

  it("every card of that discard is announced where the reset put it, in discard order", () => {
    const table = emptied(["filler", "hand", "filler"], ["tally"]);
    const result = play(table, UNTIL, triggering(HAND_RESPONSE));
    expect(heardDiscards(result.events)).toEqual(table.top.map((id) => discarded(id, result.played, "deck")));
    expect(windows(result.events).filter((w) => w.includes(HAND_RESPONSE.ref.id))).toHaveLength(1);
    expect(counters(result.state, table.inPlay.tally, "seen")).toBe(3);
    expect(seat(result.state).hand).toContain(table.top[1]);
    expect(seat(result.state).deck).toHaveLength(6);
    expectReplays(result);
  });

  it("'shuffle it back into your deck' is not offered for an earlier card either: the reset has done it", () => {
    const table = emptied(["back", "filler"]);
    const result = play(table, UNTIL, triggering(BACK_RESPONSE));
    expect(windows(result.events)).toEqual([]);
    expect(resolved(result.events, BACK_RESPONSE)).toEqual([]);
    expect(seat(result.state).deck).toContain(table.top[0]);
    expect(shuffles(result.events)).toBe(1);
    expectReplays(result);
  });
});

describe("§3.55 a game with no ability that hears a deck discard is unchanged", () => {
  it("records, logs and announces nothing; its log has only the moves it always had", () => {
    const table = start(["hand", "filler", "back"], { using: silentDeps });
    const result = play(table, MILL_3, defaultPick, silentDeps);
    expect(heardDiscards(result.events)).toEqual([]);
    expect(logged(result.events)).toEqual([]);
    expect(windows(result.events)).toEqual([]);
    expect(result.events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardDiscardedFromDeck")).toBe(
      false,
    );
    expect(result.state.pendingDeckDiscards).toBeUndefined();
    expect(result.state.deckDiscardWindows).toBeUndefined();
    expect(counters(result.state, table.inPlay.meter, "count")).toBe(3);
    expect(counters(result.state, table.inPlay.meter, "wild")).toBe(2);
    expectReplays(result, silentDeps);
  });

  it("the same play with listeners in the registry differs only by the new log lines when nothing answers", () => {
    const silent = play(start(["filler", "filler", "filler"], { using: silentDeps }), MILL_3, defaultPick, silentDeps);
    const table = start(["filler", "filler", "filler"]);
    const heard = play(table, MILL_3);
    // No card in play or in the discard pile answers a filler: nothing is announced, only logged.
    expect(heardDiscards(heard.events)).toEqual([]);
    expect(heard.events.filter((e) => e.type !== "cardDiscardedFromDeck")).toEqual(silent.events);
    expect(logged(heard.events)).toHaveLength(3);
    expect(heard.state.pendingDeckDiscards).toBeUndefined();
  });
});
