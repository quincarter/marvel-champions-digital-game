/**
 * Rearranging looked-at cards among the positions they hold (`EffectSpec lookAt` with `rearrange`;
 * docs/phase7-wave9.md §3.12): "look at each encounter card dealt to each player and the top card of the encounter
 * deck. You may swap any number of those cards." Any number of swaps among the same cards is one arrangement of them
 * over the same positions (RRG 1.8 "'Swap'", p. 42: each card takes the place of the other).
 *
 * Every position keeps a card, so every player keeps the number of facedown encounter cards they were dealt, in the
 * same places of their queue (RRG 1.8 "Deal, Deal an Encounter Card", p. 15), no deck gains or loses a card, and an
 * enemy keeps the number of facedown boost cards it was given, in the order they will be turned up
 * (docs/phase7-wave9.md §3.44). A card that takes a boost card's place is that boost card: facedown there, turned up
 * and resolved by the activation, with no "given a boost card" of its own. The card that leaves it for the top of a
 * deck is facedown there, or showing when a rule keeps that top faceup (`RuleSpec topOfDeckFaceup`, §3.42): "swapped
 * cards maintain the orientation … of the original card" (RRG 1.8 "'Swap'", p. 42).
 * Nothing is revealed, turned faceup or shuffled, and nothing is dealt: a card that comes to a player this way was
 * not "dealt" to them by this effect, so no "after a player is dealt an encounter card" hears it.
 */

import type { CardPosition } from "../choices.js";
import { type Ctx, emit, placeAt, relocateCard, setFrame } from "../ctx.js";
import { holdDeckTops } from "../deck-top.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { getInstance, locateCard, zoneContents } from "../query.js";
import type { StackFrame } from "../stack.js";
import type { GameState, ZoneId } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";

const sameZone = (a: ZoneId, b: ZoneId): boolean => JSON.stringify(a) === JSON.stringify(b);

const REARRANGEABLE: ReadonlySet<ZoneId["kind"]> = new Set([
  "boost",
  "dealtEncounter",
  "encounterDeck",
  "deck",
  "scenarioDeck",
  "separateDeck",
]);

/**
 * Whether a looked-at card holds a position cards can be rearranged over: out of play and facedown, among a player's
 * dealt encounter cards (not one whose reveal has begun, which is parked there while it resolves), in a deck, or on an
 * enemy as a boost card not yet turned up (docs/phase7-wave9.md §3.44: "look at that card and the top card of the
 * encounter deck. You may swap those cards"; one turned faceup is being resolved, RRG 1.8 "Boost, Boost Icon",
 * p. 11). The card a surge dealt is a facedown dealt card like any other (docs/phase7-wave9.md §4.1 Q22).
 */
export function rearrangeable(state: GameState, id: InstanceId): boolean {
  const zone = locateCard(state, id);
  const instance = getInstance(state, id);
  if (!zone || !instance || !REARRANGEABLE.has(zone.kind)) return false;
  if (zone.kind === "boost") return !instance.faceup;
  if (zone.kind !== "dealtEncounter") return true;
  return !instance.faceup && !state.stack.some((f) => f.kind === "reveal" && f.instanceId === id);
}

/** Where each card is now: its zone and its index there (0 is the top of a deck, the front of a dealt queue). */
export function positionsOf(state: GameState, ids: readonly InstanceId[]): readonly CardPosition[] {
  return ids.map((id) => {
    const zone = locateCard(state, id)!;
    return { zone, index: zoneContents(state, zone).indexOf(id) };
  });
}

/**
 * `taker` took the place of facedown boost card `was` (a swap, RRG 1.8 "'Swap'", p. 42): it is now the boost card that
 * was given (docs/phase7-wave9.md §3.44). So "that card" of a `boostCardGiven` still being answered, or still to be
 * announced, is `taker`: another response in the same window (a second copy, RRG 1.8 "Triggering Condition", p. 45)
 * looks at the card that is the boost card now, as a waiting reveal reveals the card that took its card's place
 * (`rearrangeCards`). Every frame of the stack holding that event is told, the resolving ability's included, so its
 * `eventTarget` after the swap is "the (current) boost card". Nothing happens when `zone` is not a boost card's place.
 */
export function boostCardReplaced(ctx: Ctx, zone: ZoneId, was: InstanceId, taker: InstanceId): void {
  if (zone.kind !== "boost" || was === taker) return;
  const enemyId = zone.hostInstanceId;
  const names = (event: TriggerEvent | null | undefined): event is Extract<TriggerEvent, { kind: "boostCardGiven" }> =>
    event?.kind === "boostCardGiven" && event.enemyInstanceId === enemyId && event.boostInstanceId === was;
  for (const frame of ctx.state.stack) {
    if (!("event" in frame) || !names(frame.event)) continue;
    setFrame(ctx, { ...frame, event: { ...frame.event, boostInstanceId: taker } } as StackFrame);
  }
  const pending = ctx.state.pendingBoostGiven;
  if (pending?.some((given) => given.enemyInstanceId === enemyId && given.boostInstanceId === was)) {
    ctx.state = {
      ...ctx.state,
      pendingBoostGiven: pending.map((given) =>
        given.enemyInstanceId === enemyId && given.boostInstanceId === was
          ? { ...given, boostInstanceId: taker }
          : given,
      ),
    };
  }
}

/**
 * Puts `arrangement[i]` at the position `cards[i]` holds, for every `i`; `arrangement` is the same cards in any order.
 * Logged as one `cardsRearranged` after the `cardMoved` of each card that changed zones. Returns how many cards are
 * somewhere new.
 *
 * The moves are `relocateCard`s, not `moveCard`s: `moveCard` resets a deck the moment its last card leaves it, and here
 * the card that replaces it is already on its way. A one-card encounter deck is therefore not emptied by a swap of its
 * top card and takes no acceleration token (RRG 1.8 "Encounter Deck", p. 17, resets a deck that "is empty"; a swap
 * exchanges the two cards, p. 42, and at no point leaves the deck without one).
 */
export function rearrangeCards(
  ctx: Ctx,
  playerId: PlayerId,
  cards: readonly InstanceId[],
  arrangement: readonly InstanceId[],
): number {
  const positions = positionsOf(ctx.state, cards);
  const moved = arrangement.filter((id, i) => id !== cards[i]).length;
  if (moved > 0) {
    // One change to any deck kept faceup (`holdDeckTops`): its top is read once every card is in place.
    holdDeckTops(ctx, () => {
      arrangement.forEach((id, i) => {
        const to = positions[i]!.zone;
        const from = locateCard(ctx.state, id);
        if (!from || !sameZone(from, to)) relocateCard(ctx, id, to);
      });
      // Exact places: first every arranged card to the back of its zone, so the cards that are not part of the
      // arrangement stand in their own order, then each into its index from the lowest up. An insertion then only
      // ever takes a card from behind the ones already placed, and never shifts one of them.
      arrangement.forEach((id) => placeAt(ctx, id, Number.MAX_SAFE_INTEGER));
      const byIndex = arrangement.map((id, i) => ({ id, index: positions[i]!.index }));
      for (const { id, index } of byIndex.sort((a, b) => a.index - b.index)) placeAt(ctx, id, index);
    });
    arrangement.forEach((taker, i) => boostCardReplaced(ctx, positions[i]!.zone, cards[i]!, taker));
  }
  emit(ctx, { type: "cardsRearranged", playerId, positions, instanceIds: arrangement, moved });
  return moved;
}
