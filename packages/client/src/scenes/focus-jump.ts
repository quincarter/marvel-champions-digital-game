/**
 * Moves a `FocusRoute`'s focus to a named stop, for a screen that jumps between its areas (the filters and the list on
 * Scenario select and Take your seats, `view/focus-areas.ts`).
 *
 * The route's own `focusKey` does the move (as a pad step would: the stop scrolls itself into view and the ring is
 * drawn there). It is read through a narrow type so a screen compiles against a route without it; the screen then
 * keeps its old behavior (B backs out) rather than losing the press.
 */

import type { FocusRoute } from "./focus-route.js";

type JumpableRoute = { focusKey?: (key: string | null) => void };

/** True when the route can be moved to a named stop. */
export function canJumpFocus(route: FocusRoute | null): boolean {
  return typeof (route as unknown as JumpableRoute | null)?.focusKey === "function";
}

export function jumpFocus(route: FocusRoute | null, key: string | null): void {
  (route as unknown as JumpableRoute | null)?.focusKey?.(key);
}
