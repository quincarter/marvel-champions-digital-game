import type { Settings } from "../settings.js";

/**
 * Whether the cached board model was built under a setting the player has since changed (#768: Play area order is
 * baked into the model's zone order, so a settings change must rebuild it, not just redraw it). `drawn` is the
 * settings object the table last drew with, null before the first draw.
 */
export function modelIsStale(
  drawn: Pick<Settings, "playAreaOrder"> | null,
  now: Pick<Settings, "playAreaOrder">,
): boolean {
  return drawn !== null && drawn.playAreaOrder !== now.playAreaOrder;
}
