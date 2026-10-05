/**
 * Announcing cards discarded from a player's deck (`TriggerEvent cardDiscardedFromDeck`, docs/phase7-wave7.md §3.55),
 * and dropping the ones a response took away from the discarding ability's "discarded this way" set (§4.1 Q32).
 */

import { type Ctx, emit, findFrame, updateFrame } from "../ctx.js";
import type { InstanceId } from "../ids.js";
import { boostIconsFor } from "../modifiers.js";
import { cardOf, deckDiscardStillThere, hasStarIcon } from "../query.js";
import { addPools, EMPTY_POOL, printedResources } from "../resources.js";
import type { DeckDiscard } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { pushEventsSharingResponses } from "./frames.js";
import { heard } from "./triggers.js";

/**
 * What a `moveCards` with `bind` reports of the cards it moved, as the vars `<bind>.count`, the printed resource icons
 * `<bind>.physical` / `.mental` / `.energy` / `.wild`, `<bind>.boostIcons` (printed plus modifiers) and
 * `<bind>.starIcons` (a star icon is not a boost icon, RRG 1.8 "Boost, Boost Icon", p. 11). One function, so the set
 * reads the same when it is bound and when a card a response took away is dropped from it (`settleDeckDiscards`).
 */
export function boundCardTotals(ctx: Ctx, bind: string, ids: readonly InstanceId[]): Readonly<Record<string, number>> {
  const pool = ids.reduce((sum, id) => {
    const card = cardOf(ctx.state, id);
    return card ? addPools(sum, printedResources(card)) : sum;
  }, EMPTY_POOL);
  return {
    [`${bind}.count`]: ids.length,
    [`${bind}.physical`]: pool.physical,
    [`${bind}.mental`]: pool.mental,
    [`${bind}.energy`]: pool.energy,
    [`${bind}.wild`]: pool.wild,
    [`${bind}.boostIcons`]: ids.reduce((sum, id) => sum + boostIconsFor(ctx.state, ctx.deps, id), 0),
    [`${bind}.starIcons`]: ids.filter((id) => hasStarIcon(ctx.state, id)).length,
  };
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
    const { frameId, slot } = discard.boundOn;
    const frame = findFrame(ctx.state, frameId);
    if (!frame || (frame.kind !== "effects" && frame.kind !== "ability" && frame.kind !== "playCard")) continue;
    const bound = frame.bindings[slot];
    if (!bound?.includes(discard.instanceId)) continue;
    const left = bound.filter((id) => id !== discard.instanceId);
    const totals = boundCardTotals(ctx, slot, left);
    updateFrame(ctx, frameId, (f) => {
      if (f.kind !== "effects" && f.kind !== "ability" && f.kind !== "playCard") return f;
      // Only the totals this set already reports: a cost's slot carries none, a "discard until" only its count.
      const vars: Record<string, number> = { ...f.vars };
      for (const [key, amount] of Object.entries(totals)) if (key in vars) vars[key] = amount;
      return { ...f, bindings: { ...f.bindings, [slot]: left }, vars };
    });
    emit(ctx, { type: "deckDiscardNotCounted", playerId: discard.playerId, instanceId: discard.instanceId, slot });
  }
}
