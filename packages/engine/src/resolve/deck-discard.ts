/**
 * Announcing cards discarded from a player's deck (`TriggerEvent cardDiscardedFromDeck`, docs/phase7-wave7.md §3.55),
 * and dropping the ones a response took away from the discarding ability's "discarded this way" set (§4.1 Q32).
 */

import { type Ctx, emit, findFrame, updateFrame } from "../ctx.js";
import type { FrameId, InstanceId } from "../ids.js";
import { boostIconsFor } from "../modifiers.js";
import { deckDiscardStillThere, hasStarIcon, showingResources } from "../query.js";
import { addPools, EMPTY_POOL, type ResourcePool } from "../resources.js";
import { countedResourcesOf, DECK_DISCARDS_PREFIX } from "../select.js";
import type { Bindings } from "../stack.js";
import type { DeckDiscard } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { pushEventsSharingResponses } from "./frames.js";
import { heard } from "./triggers.js";

/**
 * What a `moveCards` with `bind` reports of the cards it moved, as the vars `<bind>.count`, the printed resource icons
 * `<bind>.physical` / `.mental` / `.energy` / `.wild`, `<bind>.boostIcons` (printed plus modifiers) and
 * `<bind>.starIcons` (a star icon is not a boost icon, RRG 1.8 "Boost, Boost Icon", p. 11). One function, so the set
 * reads the same when it is bound and when a card a response took away is dropped from it (`settleDeckDiscards`).
 *
 * `bindings`: the frame's, for the cards it discarded from a deck, whose icons may count more than once
 * (`boundIconTotals`).
 */
export function boundCardTotals(
  ctx: Ctx,
  bind: string,
  ids: readonly InstanceId[],
  bindings: Bindings,
): Readonly<Record<string, number>> {
  return {
    [`${bind}.count`]: ids.length,
    ...boundIconTotals(ctx, bind, ids, bindings),
    [`${bind}.boostIcons`]: ids.reduce((sum, id) => sum + boostIconsFor(ctx.state, ctx.deps, id), 0),
    [`${bind}.starIcons`]: ids.filter((id) => hasStarIcon(ctx.state, id)).length,
  };
}

/**
 * The printed resource icons of a bound set, as `<bind>.physical` / `.mental` / `.energy` / `.wild`: the printed icons
 * of each card, an icon of a card the frame discarded from a deck counted as many times as a `deckDiscardIconCount`
 * rule says (`countedResourcesOf`, docs/phase7-wave7.md §3.56). Which cards those are is known once they have moved
 * (`recordDeckDiscard`), so a `moveCards` reads these again after its move (`recountDeckDiscardIcons`).
 */
function boundIconTotals(
  ctx: Ctx,
  bind: string,
  ids: readonly InstanceId[],
  bindings: Bindings,
): Readonly<Record<string, number>> {
  const pool = ids.reduce<ResourcePool>((sum, id) => {
    return addPools(sum, countedResourcesOf(ctx.state, id, showingResources(ctx.state, id), bindings, ctx.deps));
  }, EMPTY_POOL);
  return {
    [`${bind}.physical`]: pool.physical,
    [`${bind}.mental`]: pool.mental,
    [`${bind}.energy`]: pool.energy,
    [`${bind}.wild`]: pool.wild,
  };
}

/**
 * After a `moveCards` with `bind` has moved its cards: the set's icon totals read again, now that the frame records
 * which of them it discarded from a player's deck. Nothing changes for a set with no such card.
 */
export function recountDeckDiscardIcons(ctx: Ctx, frameId: FrameId, bind: string): void {
  const frame = findFrame(ctx.state, frameId);
  if (frame?.kind !== "effects") return;
  const ids = frame.bindings[bind] ?? [];
  const fromDeck = Object.entries(frame.bindings).some(
    ([slot, discarded]) => slot.startsWith(DECK_DISCARDS_PREFIX) && ids.some((id) => discarded.includes(id)),
  );
  if (!fromDeck) return;
  const totals = boundIconTotals(ctx, bind, ids, frame.bindings);
  updateFrame(ctx, frameId, (f) => (f.kind === "effects" ? { ...f, vars: { ...f.vars, ...totals } } : f));
}

const eventOf = (discard: DeckDiscard): TriggerEvent => ({
  kind: "cardDiscardedFromDeck",
  instanceId: discard.instanceId,
  playerId: discard.playerId,
  fromTop: true,
  sourceInstanceId: discard.sourceInstanceId,
  at: discard.at,
});

/**
 * Announces each card discarded from a player's deck since the last look (recorded by `recordDeckDiscard`), when an
 * ability hears it, and empties the list; the first discarded resolves first. Those recorded since the last look were
 * discarded by one effect or one cost payment, so they share one response window (RRG 1.8 "Triggering Condition",
 * p. 45), in which the player orders their responses as in any window. The flow looks here between frames, so the
 * window resolves before the discarding ability's next effect, or, for a cost, before the ability's effects: what that
 * ability then reads of the cards "discarded this way" is what the responses left (§4.1 Q32, `settleDeckDiscards`).
 * Returns true when it pushed a frame.
 */
export function announceDeckDiscards(ctx: Ctx): boolean {
  const pending = ctx.state.pendingDeckDiscards;
  if (!pending || pending.length === 0) return false;
  const { pendingDeckDiscards: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events = pending
    .filter((discard) => deckDiscardStillThere(ctx.state, discard))
    .map(eventOf)
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  const frameIds = pushEventsSharingResponses(ctx, events);
  // Every card of the batch that sits in a bound set is watched, heard or not: one card's response may move another.
  const discards = pending.filter((discard) => discard.boundOn && deckDiscardStillThere(ctx.state, discard));
  const frameId = frameIds[frameIds.length - 1];
  if (frameId !== undefined && discards.length > 0) {
    ctx.state = {
      ...ctx.state,
      deckDiscardWindows: [...(ctx.state.deckDiscardWindows ?? []), { frameId, discards }],
    };
  }
  return true;
}

/**
 * Closes each deck-discard response window whose opening frame has left the stack (`GameState.deckDiscardWindows`):
 * every response to those discards has resolved. A card no longer where its discard left it was taken away by a
 * response, its own or another card's, and is dropped from the discarding ability's bound set before that ability
 * resolves any further. Owner decision, 2026-10-05 (docs/phase7-wave7.md §4.1 Q32), applying the ruling of April 30,
 * 2026 - Ruling 4, answer 1 generally: "You can trigger Digging Deep's Response to add it to your hand; if you do, it
 * does not count for the mission attempt".
 *
 * A card the deck's reset shuffled into the new deck (`at: "deck"`) and no response moved stays in the set, as it did
 * before these events existed (docs/phase7-wave3.md §4 Q18). The set's `moveCards` totals are read again from the cards
 * left in it (`boundCardTotals`), and a `<slot>.count` on its own (`discardDeckUntil`) is the number left.
 */
export function settleDeckDiscards(ctx: Ctx): void {
  const windows = ctx.state.deckDiscardWindows;
  if (!windows) return;
  const closed = windows.filter((window) => !findFrame(ctx.state, window.frameId));
  if (closed.length === 0) return;
  const open = windows.filter((window) => !closed.includes(window));
  const { deckDiscardWindows: _, ...rest } = ctx.state;
  ctx.state = open.length > 0 ? { ...rest, deckDiscardWindows: open } : rest;
  for (const discard of closed.flatMap((window) => window.discards)) {
    if (!discard.boundOn || deckDiscardStillThere(ctx.state, discard)) continue;
    const { frameId } = discard.boundOn;
    // Each set of the frame that holds the card: its "discarded this way" slot, and a `discardDeckUntil`'s set of
    // every card it discarded (`DeckDiscard.boundOn.also`, docs/phase7-wave8.md §3.71).
    for (const slot of [discard.boundOn.slot, ...(discard.boundOn.also ?? [])]) {
      if (!dropFromBoundSet(ctx, frameId, slot, discard.instanceId)) continue;
      emit(ctx, { type: "deckDiscardNotCounted", playerId: discard.playerId, instanceId: discard.instanceId, slot });
    }
  }
}

/**
 * Takes `instanceId` out of the set frame `frameId` keeps in `slot` of the cards it discarded "this way", and reads the
 * set's totals again from the cards left in it (`boundCardTotals`); a `<slot>.count` on its own is the number left.
 * False when the frame is gone or the card is not in that set. Used for a card a response took away from where its
 * discard left it (`settleDeckDiscards`) and for one whose discard was replaced before it happened
 * (`resolve/would-discard.ts`).
 */
export function dropFromBoundSet(ctx: Ctx, frameId: FrameId, slot: string, instanceId: InstanceId): boolean {
  const frame = findFrame(ctx.state, frameId);
  if (!frame || (frame.kind !== "effects" && frame.kind !== "ability" && frame.kind !== "playCard")) return false;
  const bound = frame.bindings[slot];
  if (!bound?.includes(instanceId)) return false;
  const left = bound.filter((id) => id !== instanceId);
  // The card is no longer one the frame discarded from a deck either (`deckDiscardsSlot`).
  const bindings: Record<string, readonly InstanceId[]> = { ...frame.bindings, [slot]: left };
  for (const [key, ids] of Object.entries(bindings)) {
    if (key.startsWith(DECK_DISCARDS_PREFIX)) bindings[key] = ids.filter((id) => id !== instanceId);
  }
  const totals = boundCardTotals(ctx, slot, left, bindings);
  updateFrame(ctx, frameId, (f) => {
    if (f.kind !== "effects" && f.kind !== "ability" && f.kind !== "playCard") return f;
    // Only the totals this set already reports: a cost's slot reports none (its cards are counted where they are
    // read, `ValueSpec totalPrintedResources`), a "discard until" only its count.
    const vars: Record<string, number> = { ...f.vars };
    for (const [key, amount] of Object.entries(totals)) if (key in vars) vars[key] = amount;
    return { ...f, bindings, vars };
  });
  return true;
}
