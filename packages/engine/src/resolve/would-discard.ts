/**
 * The "would be discarded" interrupt window in front of a discard from a player's hand or deck (`TriggerEvent
 * cardBeingDiscarded`; docs/phase7-wave9.md §4.1 Q20 = B): "Interrupt: When an encounter card effect would discard a
 * card you control, discard [this card] instead of discarding that card." The in-play half of that text is
 * `cardLeavesPlay`; this is the half RRG 1.8 "Ownership and Control" (p. 31) adds: "A player controls the cards in
 * their own out-of-play areas (such as the hand, the deck, and the discard pile)."
 *
 * What the rules text settles, and how it is built here:
 *
 * - **The replaced card stays where it was.** RRG 1.8 "Replacement Effect" (p. 37): "A replacement effect replaces a
 *   specified effect with a different effect … When an effect is replaced, it is no longer considered imminent and no
 *   further interrupts or responses to that effect can be triggered." The discard is the event's apply step; a
 *   cancelled event never applies, so the card stays in the hand, or on the deck in its place.
 * - **A random discard picks its card first.** The triggering condition is a card that would be discarded ("that
 *   card"), so there is nothing to interrupt until the card is known: every card of a random discard is picked, then
 *   each is announced. A card whose discard was replaced is not picked again by the same effect.
 * - **Each card of "discard N cards" is its own discard.** RRG 1.8 "Discard" (p. 16) calls the cards of one effect
 *   "simultaneous" and holds the responses until all are made; each still has its own interrupt window (RRG 1.8
 *   "Triggering Condition", p. 45), opened as its turn comes and only if an ability can still answer, so an ability
 *   that is discarded by its own replacement answers one card and is not asked about the next.
 * - **A cost is not replaced.** RRG 1.8 "Cost" (p. 13): the arrow "distinguishes a cost from an effect". Costs are
 *   paid by their own paths (`payCost`), which announce nothing, whichever card prints the cost.
 * - **A replaced discard is not a card "discarded this way".** The card was not discarded (above), so it leaves the
 *   set its ability keeps (`dropFromBoundSet`), and the card discarded instead was discarded by the replacing
 *   ability, not "this way". NOT SETTLED by a ruling, and the in-play precedent reads differently: Caught Off Guard's
 *   "If no cards were discarded this way, this card gains surge" is scripted on whether a card could be chosen, so a
 *   replaced in-play discard does not surge. Reported with §4.1 Q20.
 *
 * Like every other optional announcement, the event goes on the stack only when an ability could react (`heard`), and
 * nothing here runs at all for a registry with no listener (`listensForWouldDiscard`): such a game keeps its log, its
 * state, its random numbers and its replay.
 */

import type { CardId } from "@mc/content";
import type { EngineDeps } from "../abilities.js";
import type { Ctx } from "../ctx.js";
import { type DeckDiscarder, discardFromHand, leaveCauseSide } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { locateCard, mustPlayer } from "../query.js";
import { nextInt } from "../rng.js";
import type { GameState } from "../state.js";
import type { OutOfPlayDiscard, TriggerEvent } from "../trigger-events.js";
import { moveCardsTo } from "./cards.js";
import { dropFromBoundSet, recountDeckDiscardIcons } from "./deck-discard.js";
import { heard } from "./triggers.js";

type BeingDiscarded = Extract<TriggerEvent, { kind: "cardBeingDiscarded" }>;

const LISTENS_FOR_WOULD_DISCARD = new WeakMap<EngineDeps, boolean>();

/**
 * Whether any ability in the registry triggers on `cardBeingDiscarded`; cached per registry. Cards are discarded from
 * hands and decks in every game, so nothing is read or announced for a registry with no such ability.
 */
export function listensForWouldDiscard(deps: EngineDeps): boolean {
  const cached = LISTENS_FOR_WOULD_DISCARD.get(deps);
  if (cached !== undefined) return cached;
  const listens = Object.values(deps.abilities).some((definition) => {
    const trigger = definition.trigger;
    if (!("on" in trigger) || !trigger.on) return false;
    const kinds = typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
    return kinds.includes("cardBeingDiscarded");
  });
  LISTENS_FOR_WOULD_DISCARD.set(deps, listens);
  return listens;
}

/** The card whose ability's effect discards: its instance, and its card as `leaveCauseSide` reads it. */
export interface DiscardSource {
  readonly sourceInstanceId: InstanceId | null;
  readonly sourceCardId: CardId | undefined;
}

/** The `cardBeingDiscarded` event of `id`, read from the game as it is now; null for a card in no hand and no deck. */
function beingDiscarded(
  state: GameState,
  id: InstanceId,
  source: DiscardSource,
  discard: OutOfPlayDiscard,
): BeingDiscarded | null {
  const zone = locateCard(state, id);
  if (zone?.kind !== "hand" && zone?.kind !== "deck") return null;
  // Only an effect is announced, never a cost (the callers are effects), so the side is the source card's.
  const by = leaveCauseSide(state, source.sourceCardId);
  return {
    kind: "cardBeingDiscarded",
    instanceId: id,
    playerId: zone.playerId,
    from: zone.kind,
    to: "discard",
    sourceInstanceId: source.sourceInstanceId,
    ...(by ? { by } : {}),
    ...(source.sourceCardId !== undefined ? { sourceCardId: source.sourceCardId } : {}),
    discard,
  };
}

/**
 * Splits the cards an effect is about to discard into the ones to discard `now`, by the caller's own path, and the
 * events of the ones that are `waiting` for their "would be discarded" window, for the caller to push once `now` is
 * done. Once one card of the effect waits, every later card of a hand or a deck waits behind it, so the cards reach
 * the discard pile in the order the effect named them (as `tuckOrAnnounce`); a card that is in neither (a card in
 * play goes through `cardLeavesPlay`) is always `now`.
 */
export function splitWouldDiscard(
  ctx: Ctx,
  ids: readonly InstanceId[],
  source: DiscardSource,
  discard: OutOfPlayDiscard,
): { readonly now: readonly InstanceId[]; readonly waiting: readonly TriggerEvent[] } {
  if (!listensForWouldDiscard(ctx.deps)) return { now: ids, waiting: [] };
  const now: InstanceId[] = [];
  const waiting: TriggerEvent[] = [];
  for (const id of ids) {
    const event = beingDiscarded(ctx.state, id, source, discard);
    if (event && (waiting.length > 0 || heard(ctx.state, ctx.deps, event))) waiting.push(event);
    else now.push(id);
  }
  return { now, waiting };
}

/**
 * The cards "discard `amount` cards at random from your hand" discards, picked one at a time with the game's seeded
 * RNG before any is discarded, so each can be announced as the card that would be discarded. The picks are those
 * `discardRandomFromHand` makes: the next card comes from the hand without the cards already picked. Used only when
 * an ability in the registry listens (`listensForWouldDiscard`); other games keep `discardRandomFromHand`, whose
 * discards can reset an empty deck (a shuffle) between two picks.
 */
export function pickRandomFromHand(
  ctx: Ctx,
  playerId: PlayerId,
  amount: number,
  exclude: readonly InstanceId[] = [],
): readonly InstanceId[] {
  const picked: InstanceId[] = [];
  for (let i = 0; i < amount; i++) {
    const hand = mustPlayer(ctx.state, playerId).hand.filter((id) => !exclude.includes(id) && !picked.includes(id));
    if (hand.length === 0) break;
    const [index, rng] = nextInt(ctx.state.rng, hand.length);
    ctx.state = { ...ctx.state, rng };
    const card = hand[index];
    if (!card) break;
    picked.push(card);
  }
  return picked;
}

/** The player whose hand or deck still holds the event's card where it was announced, if it does. */
const stillThere = (state: GameState, event: BeingDiscarded): boolean => {
  const zone = locateCard(state, event.instanceId);
  return zone?.kind === event.from && zone.playerId === event.playerId;
};

/**
 * A `cardBeingDiscarded` whose interrupts have resolved: the card is discarded now, by the path its effect would
 * have taken (`OutOfPlayDiscard`). A card an interrupt moved away is no longer there to discard: nothing happens, and
 * it leaves the set of cards "discarded this way". Returns whether a card was discarded.
 */
export function applyWouldDiscard(ctx: Ctx, event: BeingDiscarded): boolean {
  if (!stillThere(ctx.state, event)) {
    wouldDiscardNotMade(ctx, event);
    return false;
  }
  if (event.discard.kind === "hand") {
    discardFromHand(ctx, event.playerId, event.instanceId);
    return true;
  }
  const { boundOn } = event.discard;
  const by: DeckDiscarder = { sourceInstanceId: event.sourceInstanceId, ...(boundOn ? { boundOn } : {}) };
  moveCardsTo(ctx, [event.instanceId], "discard", undefined, event.sourceCardId, by);
  if (boundOn) recountDeckDiscardIcons(ctx, boundOn.frameId, boundOn.slot);
  return true;
}

/**
 * A `cardBeingDiscarded` that was cancelled or replaced, or whose card was gone: the card was not discarded, so it is
 * not one of the cards its ability "discarded this way" (see the file comment for what is not settled).
 */
export function wouldDiscardNotMade(ctx: Ctx, event: BeingDiscarded): void {
  if (event.discard.kind !== "moveCards" || !event.discard.boundOn) return;
  const { frameId, slot, also } = event.discard.boundOn;
  for (const each of [slot, ...(also ?? [])]) dropFromBoundSet(ctx, frameId, each, event.instanceId);
}
