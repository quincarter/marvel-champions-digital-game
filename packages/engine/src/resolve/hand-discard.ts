/**
 * Announcing cards discarded from a hand by a card's ability (`TriggerEvent cardDiscardedFromHand`, issue #922): the
 * hand's counterpart of `announceDeckDiscards` and `announceTuckedDiscards`.
 */

import type { Ctx } from "../ctx.js";
import { handDiscardStillThere } from "../query.js";
import type { TriggerEvent } from "../trigger-events.js";
import { pushEventsSharingResponses } from "./frames.js";
import { heard } from "./triggers.js";
import type { GameState } from "../state.js";

/** The prefix of the vars a choosing `discardFromHand` keeps while it asks one player after another. */
const DISCARD_HAND_VARS = "_discardHand.";

/**
 * Whether a discard from a hand is still being made on the stack: an effects frame part way through asking each
 * player for their discard (`executeDiscardFromHand`), or a card waiting in its "would be discarded" window
 * (`cardBeingDiscarded`, `resolve/would-discard.ts`).
 *
 * The whole stack is read on purpose: a hand discard made inside such a window (an interrupt's hand-discard cost) waits
 * for it too, and then shares the outer discards' response window. Rare, and nothing goes unannounced.
 */
function discardStillMaking(state: GameState): boolean {
  return state.stack.some(
    (frame) =>
      (frame.kind === "event" && frame.event.kind === "cardBeingDiscarded") ||
      (frame.kind === "effects" && Object.keys(frame.vars).some((key) => key.startsWith(DISCARD_HAND_VARS))),
  );
}

/**
 * Announces each card discarded from a hand by an ability since the last look (recorded by `recordHandDiscard`), when
 * an ability hears it, and empties the list; the first discarded resolves first. Those recorded since the last look
 * were discarded by one effect or one cost payment, so they share one response window (RRG 1.8 "Discard", p. 16:
 * "Responses to the discarding of any of those cards are resolved after all discards are made"; "Triggering
 * Condition", p. 45). The flow looks here between frames, so the window resolves before the discarding ability's next
 * effect, or, for a cost, before the ability's effects. A card no longer in a discard pile is not announced. Returns
 * true when it pushed a frame.
 *
 * Held while the discarding effect is still making its discards (`discardStillMaking`): "each player discards" asks
 * one player at a time, and a card some ability may replace waits in its own "would be discarded" window, but the
 * discards are one simultaneous set whose responses come after all of them (RRG 1.8 "Discard", p. 16).
 */
export function announceHandDiscards(ctx: Ctx): boolean {
  const pending = ctx.state.pendingHandDiscards;
  if (!pending || pending.length === 0) return false;
  if (discardStillMaking(ctx.state)) return false;
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
