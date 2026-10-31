/**
 * Which of the top bar's chrome buttons a screen's focus route takes as stops (`scenes/focus-route.ts`): the music note
 * and the bug on every screen, and the language and theme buttons beside them on a screen that asks for the whole row
 * (Title). Pure, so the rule is tested without a scene.
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
  /** Left out by a route that takes only the note and the bug. */
  readonly language?: Rect | null;
  readonly theme?: Rect | null;
  /** The rects of the screen's own stops. */
  readonly own: readonly Rect[];
}

export interface ChromeStops {
  readonly music: Rect | null;
  readonly report: Rect | null;
  readonly language: Rect | null;
  readonly theme: Rect | null;
}

const NONE: ChromeStops = { music: null, report: null, language: null, theme: null };

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export function chromeStopsOf(input: ChromeStopInput): ChromeStops {
  if (input.excluded || !input.isTop) return NONE;
  const free = (rect: Rect | null | undefined): Rect | null =>
    rect && !input.own.some((own) => overlaps(own, rect)) ? rect : null;
  return {
    music: free(input.music),
    report: free(input.report),
    // Only beside the note: while the row is hidden the theme button floats on its own at the top centre.
    language: input.music ? free(input.language) : null,
    theme: input.music ? free(input.theme) : null,
  };
}
