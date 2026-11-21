/**
 * Announcing cards discarded from a hand by a card's ability (`TriggerEvent cardDiscardedFromHand`, issue #922): the
 * hand's counterpart of `announceDeckDiscards` and `announceTuckedDiscards`.
 */

import type { Ctx } from "../ctx.js";
import { handDiscardStillThere } from "../query.js";
import type { TriggerEvent } from "../trigger-events.js";
import { pushEventsSharingResponses } from "./frames.js";
import { heard } from "./triggers.js";
import type { GameState, HandDiscard } from "../state.js";

/** The prefix of the vars a choosing `discardFromHand` keeps while it asks one player after another. */
const DISCARD_HAND_VARS = "_discardHand.";

/**
 * Whether the effect that discarded this card is still making its discards on the stack: its own effects frame part
 * way through asking each player for their discard (`executeDiscardFromHand`), or another card of that effect waiting
 * in its "would be discarded" window (a `cardBeingDiscarded` whose discard it made, `resolve/would-discard.ts`). Only
 * that effect's discards wait, told apart by the frame that made them (`HandDiscard.madeBy`), not by their card: a
 * discard by another ability made meanwhile, an interrupt's cost or another ability of the same card, is its own
 * discard, with its own response window at once (Codex reviews of #927).
 */
function discardStillMaking(state: GameState, discard: HandDiscard): boolean {
  const made = discard.madeBy;
  if (made === undefined) return false;
  return state.stack.some(
    (frame) =>
      (frame.kind === "event" && frame.event.kind === "cardBeingDiscarded" && frame.event.discard.madeBy === made) ||
      (frame.kind === "effects" &&
        frame.frameId === made &&
        Object.keys(frame.vars).some((key) => key.startsWith(DISCARD_HAND_VARS))),
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
 * A card whose discarding effect is still making its discards stays recorded for a later look (`discardStillMaking`):
 * "each player discards" asks one player at a time, and a card some ability may replace waits in its own "would be
 * discarded" window, but the discards are one simultaneous set whose responses come after all of them (RRG 1.8
 * "Discard", p. 16).
 */
export function announceHandDiscards(ctx: Ctx): boolean {
  const pending = ctx.state.pendingHandDiscards;
  if (!pending || pending.length === 0) return false;
  const held = pending.filter((discard) => discardStillMaking(ctx.state, discard));
  if (held.length === pending.length) return false;
  const { pendingHandDiscards: _, ...rest } = ctx.state;
  ctx.state = held.length > 0 ? { ...rest, pendingHandDiscards: held } : rest;
  const events = pending
    .filter((discard) => !held.includes(discard))
    .filter((discard) => handDiscardStillThere(ctx.state, discard))
    .map(({ madeBy: _made, ...discard }): TriggerEvent => ({ kind: "cardDiscardedFromHand", ...discard }))
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  pushEventsSharingResponses(ctx, events);
  return true;
}
