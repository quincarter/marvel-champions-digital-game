/**
 * Announcing cards discarded from a hand by a card's ability (`TriggerEvent cardDiscardedFromHand`, issue #922): the
 * hand's counterpart of `announceDeckDiscards` and `announceTuckedDiscards`.
 */

import type { Ctx } from "../ctx.js";
import { handDiscardStillThere } from "../query.js";
import type { TriggerEvent } from "../trigger-events.js";
import { pushEventsSharingResponses } from "./frames.js";
import { heard } from "./triggers.js";

/**
 * Announces each card discarded from a hand by an ability since the last look (recorded by `recordHandDiscard`), when
 * an ability hears it, and empties the list; the first discarded resolves first. Those recorded since the last look
 * were discarded by one effect or one cost payment, so they share one response window (RRG 1.8 "Discard", p. 16:
 * "Responses to the discarding of any of those cards are resolved after all discards are made"; "Triggering
 * Condition", p. 45). The flow looks here between frames, so the window resolves before the discarding ability's next
 * effect, or, for a cost, before the ability's effects. A card no longer in a discard pile is not announced. Returns
 * true when it pushed a frame.
 */
export function announceHandDiscards(ctx: Ctx): boolean {
  const pending = ctx.state.pendingHandDiscards;
  if (!pending || pending.length === 0) return false;
  const { pendingHandDiscards: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events = pending
    .filter((discard) => handDiscardStillThere(ctx.state, discard))
    .map((discard): TriggerEvent => ({ kind: "cardDiscardedFromHand", ...discard }))
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  pushEventsSharingResponses(ctx, events);
  return true;
}
