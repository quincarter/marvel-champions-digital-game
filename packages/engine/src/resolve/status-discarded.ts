/** Announcing status cards discarded (docs/phase7-wave6.md §3.5) and placed (docs/phase7-wave7.md §3.27). */

import type { Ctx } from "../ctx.js";
import type { StatusDiscarded } from "../effects.js";
import type { TriggerEvent } from "../trigger-events.js";
import { pushEventsSharingResponses } from "./frames.js";
import { heard } from "./triggers.js";

/**
 * Pushes the `statusDiscarded` announcements one step produced (`discardStatusCards`), each one an ability listens to,
 * in one shared response window (RRG 1.8 "Triggering Condition", p. 45; docs/phase7-wave6.md §4.1 Q5): piercing two
 * tough cards off Colossus is two conditions of one occurrence, so Iron Will (no limit) answers both and Organic Steel,
 * which exhausts itself, answers one. With nothing listening nothing is pushed, so a game without such a card resolves
 * exactly as before.
 */
export function announceStatusDiscarded(ctx: Ctx, discarded: readonly StatusDiscarded[]): void {
  const listened = discarded.filter((event) => heard(ctx.state, ctx.deps, event));
  if (listened.length > 0) pushEventsSharingResponses(ctx, listened);
}

/**
 * Announces each status card placed since the last look (`TriggerEvent statusPlaced`, docs/phase7-wave7.md §3.27;
 * recorded by `giveStatus`), when an ability listens, and empties the list; the oldest resolves first. Those placed
 * since the last look were placed by one step, so they share one response window (RRG 1.8 "Triggering Condition",
 * p. 45), as `statusDiscarded`'s do. The cards are on their characters already, so a listener reads them there (an
 * "after"). Returns true when it pushed a frame.
 */
export function announceStatusPlaced(ctx: Ctx): boolean {
  const pending = ctx.state.pendingStatusPlaced;
  if (!pending || pending.length === 0) return false;
  const { pendingStatusPlaced: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events: TriggerEvent[] = pending
    .map((placed): TriggerEvent => ({ kind: "statusPlaced", ...placed }))
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  pushEventsSharingResponses(ctx, events);
  return true;
}
