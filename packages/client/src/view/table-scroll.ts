/**
 * The pure parts of scrolling the table at a larger Card size (`LayoutOptions.cardScale`, `scrollLayout`): how far a
 * wheel notch moves it, how a touch drag becomes a scroll (and when it is not one), and how far to scroll so a card
 * is on screen. The Board scene owns the offset and the redraw; none of this touches Phaser.
 */

import type { Rect } from "./layout.js";

/** Pixels one wheel "line" moves the table (a browser reports line-mode wheels in lines, not pixels). */
const WHEEL_LINE_PX = 40;

/** A wheel gesture's vertical pixels: pixel-mode deltas as they are, line-mode ones scaled. */
export function wheelPixels(deltaY: number, deltaMode: number): number {
  return deltaMode === 0 ? deltaY : deltaY * WHEEL_LINE_PX;
}

export function clampScroll(scrollY: number, maxScroll: number): number {
  return Math.min(Math.max(0, maxScroll), Math.max(0, Math.round(scrollY)));
}

/**
 * The scroll offset that brings `rect` (a card as it is drawn now, at `scrollY`) wholly into `window`, moving as little
 * as it can. A card taller than the window lines its top up instead. `scrollY` itself when it is already in view.
 */
export function revealScroll(scrollY: number, rect: Rect, window: Rect, maxScroll: number, margin = 8): number {
  const top = window.y + margin;
  const bottom = window.y + window.height - margin;
  let next = scrollY;
  if (rect.height > bottom - top || rect.y < top) next = scrollY - (top - rect.y);
  else if (rect.y + rect.height > bottom) next = scrollY + (rect.y + rect.height - bottom);
  return clampScroll(next, maxScroll);
}

/** True when `rect` lies wholly inside `window`. */
export function fullyInWindow(rect: Rect, window: Rect): boolean {
  return (
    rect.x >= window.x &&
    rect.y >= window.y &&
    rect.x + rect.width <= window.x + window.width &&
    rect.y + rect.height <= window.y + window.height
  );
}

/** A finger that moves less than this on both axes is still a tap, not a scroll. */
export const DRAG_SLOP_PX = 10;

/**
 * One finger's drag on the table. It decides on the first move past the slop: mostly vertical is a scroll for the rest
 * of the gesture, mostly horizontal is not ours (a card row or the hand takes it) and stays that way until the finger
 * lifts. Mouse and pen pointers never drag the table; the Board feeds this touches only.
 */
export class TableDrag {
  #id: number | null = null;
  #startX = 0;
  #startY = 0;
  #lastY = 0;
  #mode: "undecided" | "scroll" | "ignored" = "undecided";

  get scrolling(): boolean {
    return this.#id !== null && this.#mode === "scroll";
  }

  down(id: number, x: number, y: number): void {
    this.#id = id;
    this.#startX = x;
    this.#startY = y;
    this.#lastY = y;
    this.#mode = "undecided";
  }

  /** The scroll offset change for this move (positive scrolls the content up, like a finger pulling it), or 0. */
  move(id: number, x: number, y: number): number {
    if (this.#id !== id || this.#mode === "ignored") return 0;
    if (this.#mode === "undecided") {
      const dx = Math.abs(x - this.#startX);
      const dy = Math.abs(y - this.#startY);
      if (Math.max(dx, dy) < DRAG_SLOP_PX) return 0;
      this.#mode = dy > dx ? "scroll" : "ignored";
      if (this.#mode === "ignored") return 0;
      // The slop already travelled counts: the content catches up with the finger rather than lagging it.
      this.#lastY = this.#startY;
    }
    const delta = this.#lastY - y;
    this.#lastY = y;
    return delta;
  }

  up(id: number): void {
    if (this.#id === id) {
      this.#id = null;
      this.#mode = "undecided";
    }
  }
}
