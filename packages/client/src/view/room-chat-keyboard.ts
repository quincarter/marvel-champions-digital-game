/**
 * Where the lobby's chat sits while a phone's on-screen keyboard is open (issue #880): the browser's visual viewport
 * shrinks to what the keyboard leaves, and the chat field and the newest lines must stay inside it. The screen is a
 * canvas that fills the layout viewport, so the keyboard covers its bottom; the chat panel is lifted by the covered
 * height instead (the panel's bottom edge never sits below the visible bottom).
 */
import type { Rect } from "./layout.js";

/** What the browser reports: `visualViewport.height` / `offsetTop` and the layout viewport's height. */
export interface VisibleViewport {
  readonly layoutHeight: number;
  readonly visibleHeight: number;
  /** `visualViewport.offsetTop`: how far the visual viewport has scrolled down inside the layout viewport. */
  readonly offsetTop: number;
}

/** A keyboard shorter than this is browser chrome (an address bar sliding away), not a keyboard. */
export const KEYBOARD_MIN_PX = 120;

/** How much of the layout viewport's bottom is covered by something (a keyboard); 0 when nothing is. */
export function coveredBottom(view: VisibleViewport): number {
  const covered = view.layoutHeight - (view.visibleHeight + view.offsetTop);
  return covered >= KEYBOARD_MIN_PX ? Math.round(covered) : 0;
}

/**
 * The chat panel while the keyboard is up: the code header and the Start strip give way, and the panel runs from `top`
 * (just under the tab strip) down to the last visible pixel, so the field and the newest lines sit right above the
 * keyboard.
 */
export function chatRectAboveKeyboard(args: {
  readonly top: number;
  readonly x: number;
  readonly width: number;
  readonly layoutHeight: number;
  readonly covered: number;
}): Rect {
  const { top, x, width, layoutHeight, covered } = args;
  return { x, y: top, width, height: Math.max(0, layoutHeight - covered - 4 - top) };
}
