/**
 * Which of the chrome buttons (the music note, the bug, the dark mode toggle) a screen's focus route takes as stops
 * (`scenes/focus-route.ts`). Pure, so the rule is tested without a scene.
 *
 * A button is a stop only while it is drawn, only for the screen on top (so a screen under an overlay never answers
 * for a button it is not showing), and only when none of the screen's own stops already sits over it.
 */

import type { Rect } from "./layout.js";

export interface ChromeStopInput {
  /** The route's own scene is the topmost running screen (chrome scenes and the music scene not counted). */
  readonly isTop: boolean;
  /** The route belongs to a scene that has no chrome stops at all (the report sheet itself, the chrome scenes). */
  readonly excluded: boolean;
  /** Where each button is drawn now, or null while hidden. */
  readonly music: Rect | null;
  readonly report: Rect | null;
  /** The dark mode toggle (#459), drawn on every screen; optional so a caller that predates it still reads. */
  readonly theme?: Rect | null;
  /** The rects of the screen's own stops. */
  readonly own: readonly Rect[];
}

export interface ChromeStops {
  readonly music: Rect | null;
  readonly report: Rect | null;
  readonly theme: Rect | null;
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export function chromeStopsOf(input: ChromeStopInput): ChromeStops {
  if (input.excluded || !input.isTop) return { music: null, report: null, theme: null };
  const free = (rect: Rect | null): Rect | null =>
    rect !== null && !input.own.some((own) => overlaps(own, rect)) ? rect : null;
  return { music: free(input.music), report: free(input.report), theme: free(input.theme ?? null) };
}
