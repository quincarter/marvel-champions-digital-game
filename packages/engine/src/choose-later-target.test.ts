/**
 * An ability that opens with more than one required choice: each of them needs a card to choose, not only the last.
 *
 * - RRG 1.8 "Target" (p. 42): "If an ability or game function requires one or more targets, that ability or game
 *   function can only be initiated if it has at least one valid target."
 * - "Choose (Game Element)" (p. 12): "If a player card ability requires the choosing of one or more targets, and there
 *   are no valid targets for any part of the ability, the ability cannot be initiated."
 * - "'Swap'" (p. 42): "A swap cannot be completed if there is not a component in both locations. For example, you
 *   cannot 'swap a card in your hand with the top card of your deck' if you have no cards in hand."
 * - "Player Deck" (p. 33): an emptied deck is remade from the discard pile at once, so a deck is empty only while the
 *   discard pile is too, and then it has no top card.
 * - "Target" (p. 43): "An ability with a search effect requires only a searchable game area in order to initiate."
 *
 * Synthetic supports in play, each with one Action, used with `useAbility` so the hand holds only what a test puts
 * there.
 */

import type { AbilityId, CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const slot = (name: string) => ({ kind: "slot", slot: name }) as const;
const chosen = (name: string) => ({ kind: "ref", ref: slot(name) }) as const;
const HAND: CardSelector = { kind: "zone", zone: "hand", player: you };
const DISCARD_TOP: CardSelector = { kind: "zone", zone: "discard", player: you, top: n(1) };
const DECK_TOP: CardSelector = { kind: "zone", zone: "deck", player: you, top: n(1) };
const choose = (name: string, from: CardSelector, min = 1): EffectSpec => ({
  kind: "chooseCards",
  slot: name,
  from,
  chooser: you,
  min,
  max: 1,
});

/** The cards the tests deal: told apart by name. */
const WIDGET = stubEvent({ id: "widget", cost: 9 });
const GADGET = stubEvent({ id: "gadget", cost: 9 });

const support = (id: string, effects: readonly EffectSpec[], more: Partial<AbilityDefinition> = {}) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...more });
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};

/** "Swap a card in your hand with the top card of your deck." Once per round. */
const SWAP_DECK = support(
  "swap-deck",
  [choose("mine", HAND), choose("top", DECK_TOP), { kind: "swapCards", a: slot("mine"), b: slot("top") }],
  { limit: { count: 1, period: "round" } },
);
/** "Swap a card in your hand with the top card of your discard pile." */
const SWAP_DISCARD = support("swap-discard", [
  choose("mine", HAND),
  choose("top", DISCARD_TOP),
  { kind: "swapCards", a: slot("mine"), b: slot("top") },
]);
/** "Draw 1 card. Choose a card in your hand and discard it.": the choice is among what the draw leaves. */
const DRAW_THEN_CHOOSE = support("draw-then-choose", [
  { kind: "draw", player: you, amount: n(1) },
  choose("mine", HAND),
  { kind: "moveCards", cards: chosen("mine"), to: "discard" },
]);
/** "Discard a card from your hand. You may return the top card of your discard pile to your hand first." */
const OPTIONAL_SECOND = support("optional-second", [
  choose("mine", HAND),
  choose("top", DISCARD_TOP, 0),
  { kind: "moveCards", cards: chosen("top"), to: "hand" },
  { kind: "moveCards", cards: chosen("mine"), to: "discard" },
]);
/** "Discard a card from your hand. Search your deck for a gadget and add it to your hand." */
const SEARCH_SECOND = support("search-second", [
  choose("mine", HAND),
  choose("found", { kind: "zone", zone: "deck", player: you, filter: { name: "gadget" } }),
  { kind: "moveCards", cards: chosen("mine"), to: "discard" },
  { kind: "moveCards", cards: chosen("found"), to: "hand" },
]);
/** Two parts, each with a choice of its own: "Discard a card from your hand. Shuffle the top card of your discard pile into your deck." */
const TWO_PARTS = support("two-parts", [
  choose("mine", HAND),
  choose("top", DISCARD_TOP),
  { kind: "moveCards", cards: chosen("mine"), to: "deckBottom" },
  { kind: "moveCards", cards: chosen("top"), to: "deckBottom" },
]);

const SUPPORTS = [SWAP_DECK, SWAP_DISCARD, DRAW_THEN_CHOOSE, OPTIONAL_SECOND, SEARCH_SECOND, TWO_PARTS];
const deps: EngineDeps = depsOf(...SUPPORTS.map((s) => s.ability));

type Zones = {
  readonly hand?: readonly CardId[];
  readonly deck?: readonly CardId[];
  readonly discard?: readonly CardId[];
};

/**
 * The first turn with `card` in play and exactly the named cards in hand, deck (top first) and discard pile (top
 * first); every other player card is taken out of the three zones.
 */
function table(card: CardId, zones: Zones): { readonly state: GameState; readonly source: InstanceId } {
  const start = gameAtFirstTurn({
    cards: [WIDGET, GADGET, ...SUPPORTS.map((s) => s.card)],
    deps,
    deck: [...copiesOf(WIDGET.id, 4), ...copiesOf(GADGET.id, 4), ...SUPPORTS.map((s) => s.card.id)],
  });
  const placed = playerCardIntoPlay(start, card);
  const seat = mustPlayer(placed.state, P1);
  const pool = [...seat.hand, ...seat.deck, ...seat.discard];
  const take = (wanted: readonly CardId[] = []): InstanceId[] =>
    wanted.map((cardId) => {
      const index = pool.findIndex((id) => placed.state.instances[id]?.cardId === cardId);
      if (index < 0) throw new Error(`no ${cardId} left to place`);
      return pool.splice(index, 1)[0] as InstanceId;
    });
  const hand = take(zones.hand);
  const deck = take(zones.deck);
  const discard = take(zones.discard);
  return {
    source: placed.id,
    state: {
      ...placed.state,
      players: placed.state.players.map((p) => (p.playerId === P1 ? { ...p, hand, deck, discard } : p)),
    },
  };
}

const use = (source: InstanceId, abilityId: AbilityId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: source,
  abilityId,
  payment: [],
});
const offered = (state: GameState, source: InstanceId): boolean => {
  const legal = legalActions(state, P1, deps);
  return (
    legal.kind === "turn" && legal.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === source)
  );
};
const names = (state: GameState, where: "hand" | "deck" | "discard"): readonly string[] =>
  mustPlayer(state, P1)[where].map((id) => state.instances[id]?.cardId as string);
/** Uses the ability and answers every choice with its first option. */
const resolve = (state: GameState, source: InstanceId, abilityId: AbilityId) => {
  const { session, events } = driveSession(startSession(state), deps, [use(source, abilityId)]);
  return { state: session.state, events };
};

describe("an ability that opens with two required choices", () => {
  it("with a card for each, both are chosen and the swap resolves (control)", () => {
    const { state, source } = table(SWAP_DECK.card.id, { hand: [WIDGET.id], deck: [GADGET.id, WIDGET.id] });
    expect(offered(state, source)).toBe(true);
    const after = resolve(state, source, SWAP_DECK.ability.ref.id);
    expect(names(after.state, "hand")).toEqual(["gadget"]);
    expect(names(after.state, "deck")).toEqual(["widget", "widget"]);
    expect(after.events.filter((e) => e.type === "swapRefused")).toEqual([]);
    expect(after.events.filter((e) => e.type === "cardsSwapped")).toHaveLength(1);
  });

  it("with nothing for the first choice it cannot be initiated: refused, not offered, and its limit is not spent", () => {
    const { state, source } = table(SWAP_DECK.card.id, { hand: [], deck: [GADGET.id, WIDGET.id] });
    const result = applyCommand(state, use(source, SWAP_DECK.ability.ref.id), deps);
    // A refused command returns no state and no events: nothing was resolved, logged or counted against the limit.
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "no_valid_target", message: "that ability has no valid target" }),
    });
    expect(offered(state, source)).toBe(false);
    // The same round, with a card in hand, the once-per-round ability is still there to use, once.
    const dealt = table(SWAP_DECK.card.id, { hand: [WIDGET.id], deck: [GADGET.id, WIDGET.id] });
    const withCard = { ...state, players: dealt.state.players };
    expect(offered(withCard, source)).toBe(true);
    const after = resolve(withCard, source, SWAP_DECK.ability.ref.id);
    expect(names(after.state, "hand")).toEqual(["gadget"]);
    expect(applyCommand(after.state, use(source, SWAP_DECK.ability.ref.id), deps).ok).toBe(false);
  });

  it("'the top card of your deck' with an empty deck and an empty discard pile is no card: refused, not offered", () => {
    const { state, source } = table(SWAP_DECK.card.id, { hand: [WIDGET.id], deck: [], discard: [] });
    const result = applyCommand(state, use(source, SWAP_DECK.ability.ref.id), deps);
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "no_valid_target" }) });
    expect(offered(state, source)).toBe(false);
  });

  it("the first choice is judged when the second is the one with a card (hand empty, discard pile not)", () => {
    const { state, source } = table(SWAP_DISCARD.card.id, { hand: [], deck: [WIDGET.id], discard: [GADGET.id] });
    const result = applyCommand(state, use(source, SWAP_DISCARD.ability.ref.id), deps);
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "no_valid_target" }) });
    expect(offered(state, source)).toBe(false);
  });

  it("…and the second when the first is (hand not empty, discard pile empty)", () => {
    const { state, source } = table(SWAP_DISCARD.card.id, { hand: [WIDGET.id], deck: [WIDGET.id], discard: [] });
    const result = applyCommand(state, use(source, SWAP_DISCARD.ability.ref.id), deps);
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "no_valid_target" }) });
    expect(offered(state, source)).toBe(false);
  });

  it("an effect that uses only the choice that has a card is a part of its own: the ability still initiates", () => {
    const { state, source } = table(TWO_PARTS.card.id, { hand: [], deck: [WIDGET.id], discard: [GADGET.id] });
    expect(offered(state, source)).toBe(true);
    const after = resolve(state, source, TWO_PARTS.ability.ref.id);
    expect(names(after.state, "discard")).toEqual([]);
    expect(names(after.state, "deck")).toEqual(["widget", "gadget"]);
    expect(after.events).toContainEqual({ type: "choiceFoundNothing", slot: "mine" });
  });

  it("…but not when neither choice has a card", () => {
    const { state, source } = table(TWO_PARTS.card.id, { hand: [], deck: [WIDGET.id], discard: [] });
    const result = applyCommand(state, use(source, TWO_PARTS.ability.ref.id), deps);
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "no_valid_target" }) });
    expect(offered(state, source)).toBe(false);
  });
});

describe("choices that are not judged before the ability starts", () => {
  it("a choice after another effect chooses among what that effect leaves: it starts with an empty hand", () => {
    const { state, source } = table(DRAW_THEN_CHOOSE.card.id, { hand: [], deck: [GADGET.id, WIDGET.id] });
    expect(offered(state, source)).toBe(true);
    const after = resolve(state, source, DRAW_THEN_CHOOSE.ability.ref.id);
    // The gadget was drawn, then chosen and discarded.
    expect(names(after.state, "hand")).toEqual([]);
    expect(names(after.state, "discard")).toEqual(["gadget"]);
    expect(names(after.state, "deck")).toEqual(["widget"]);
    expect(after.events.filter((e) => e.type === "choiceFoundNothing")).toEqual([]);
  });

  it("an optional second choice (min 0) with nothing to choose does not block the ability", () => {
    const { state, source } = table(OPTIONAL_SECOND.card.id, { hand: [WIDGET.id], deck: [GADGET.id], discard: [] });
    expect(offered(state, source)).toBe(true);
    const after = resolve(state, source, OPTIONAL_SECOND.ability.ref.id);
    expect(names(after.state, "hand")).toEqual([]);
    expect(names(after.state, "discard")).toEqual(["widget"]);
    expect(after.events.filter((e) => e.type === "choiceFoundNothing")).toEqual([]);
  });

  it("a search as the second choice needs only a deck to search, whatever is in it", () => {
    const { state, source } = table(SEARCH_SECOND.card.id, { hand: [WIDGET.id], deck: [WIDGET.id], discard: [] });
    expect(offered(state, source)).toBe(true);
    const after = resolve(state, source, SEARCH_SECOND.ability.ref.id);
    expect(names(after.state, "hand")).toEqual([]);
    expect(names(after.state, "discard")).toEqual(["widget"]);
    expect(after.events).toContainEqual({ type: "preThenUnresolved", cause: "searchFoundNothing" });
  });
});
