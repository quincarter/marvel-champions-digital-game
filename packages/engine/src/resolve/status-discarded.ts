/** Announcing status cards discarded (docs/phase7-wave6.md §3.5). */

import type { Ctx } from "../ctx.js";
import type { StatusDiscarded } from "../effects.js";
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
