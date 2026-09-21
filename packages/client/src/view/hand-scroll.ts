/**
 * The tabbed hand's scroll state.
 *
 * The tabbed hand always shows every card at full size and scrolls. It used to
 * collapse the overflow to spines behind a "Fan out"/"Collapse" pill; reported
 * from play on a phone (2026-09-21), the collapsed row was never the one anyone
 * wanted, so the pill and the mode are gone.
 *
 * Pulled out of `scenes/board/hand.ts` on its own: that file imports Phaser and
 * the widget/theme layer at module scope, so nothing defined inside it can be
 * unit tested without a canvas. Nothing here imports Phaser.
 */

import { Momentum } from "./drag-gesture.js";
import type { Rect } from "./layout.js";

/** What a card in the row hands its tap target, so a sideways drag on it scrolls the row and a flick coasts. */
export interface RowDrag {
  onDrag(deltaX: number): void;
  onDragEnd(velocityPxPerMs: number): void;
}

/**
 * The tabbed hand's horizontal scroll.
 *
 * `cardRow`'s own output never shrinks or shifts for the scroll; the draw
 * subtracts `scrollX` from every slot's `x`, the same separation the phone tabs
 * keep between "what the layout computed" and "what the player is currently
 * looking at."
 */
export class HandScroll {
  readonly #redraw: () => void;
  /**
   * Moves what the last draw put on screen to a new `scrollX`, without redrawing. Set by a draw that built the row
   * as one translatable strip (`attach`). A board redraw rebuilds every `Text` on the table, each a canvas and a
   * texture upload; at one redraw per pointer move a drag froze a phone for the length of the gesture.
   */
  #apply: ((scrollX: number) => void) | null = null;
  /** In unscrolled-layout pixels — how far the row has been dragged or scrolled left. */
  #scrollX = 0;
  /** This draw's ceiling for `#scrollX`, re-measured by `drawHand` every draw. */
  #maxScroll = 0;
  /** The hand's own content rect, unscrolled — where a wheel gesture has to land to scroll it. */
  #contentRect: Rect | null = null;
  /** The coast after a flick. Lives here, not in a draw, so it survives whatever redraws happen under it. */
  readonly #momentum = new Momentum();

  /**
   * The row under a finger: the content follows the pointer (so the scroll moves the other way), a new drag catches
   * a coasting row, and a flick hands its speed to the momentum.
   */
  readonly drag: RowDrag = {
    onDrag: (deltaX) => {
      this.#momentum.stop();
      this.scrollBy(-deltaX);
    },
    onDragEnd: (velocityPxPerMs) => this.#momentum.start(-velocityPxPerMs),
  };

  constructor(redraw: () => void) {
    this.#redraw = redraw;
  }

  get scrollX(): number {
    return this.#scrollX;
  }

  get canScroll(): boolean {
    return this.#maxScroll > 0;
  }

  /** Records this draw's row, clamping the scroll to what now fits. Forgets the last draw's strip: it is gone. */
  measure(content: Rect, rowRight: number): void {
    this.#apply = null;
    this.#maxScroll = Math.max(0, rowRight - (content.x + content.width));
    this.#scrollX = this.#maxScroll > 0 ? Math.min(this.#scrollX, this.#maxScroll) : 0;
    this.#contentRect = content;
  }

  /** Moves the scroll by a pixel delta (positive reveals more to the right), clamped to what the last draw measured. */
  scrollBy(delta: number): void {
    if (this.#maxScroll <= 0) return;
    const next = Math.min(this.#maxScroll, Math.max(0, this.#scrollX + delta));
    if (next === this.#scrollX) return;
    this.#scrollX = next;
    if (this.#apply) this.#apply(next);
    else this.#redraw();
  }

  /** Once per frame (`Scene#update`): carries a flick on, and stops it dead at either end of the row. */
  tick(deltaMs: number): void {
    if (!this.#momentum.active) return;
    const delta = this.#momentum.tick(deltaMs);
    if (delta === 0) return;
    const before = this.#scrollX;
    this.scrollBy(delta);
    if (this.#scrollX === before) this.#momentum.stop();
  }

  /** After `measure`: this draw's row can follow the scroll by itself, so a scroll no longer needs a redraw. */
  attach(apply: (scrollX: number) => void): void {
    this.#apply = apply;
  }

  /**
   * A wheel or trackpad gesture over the hand's own rect scrolls it
   * horizontally. The tabbed board is the only layout that ever needs
   * scrolling, so this is a no-op everywhere else.
   */
  onWheel(pointer: { readonly y: number }, _objects: unknown, deltaX: number, deltaY: number): void {
    const rect = this.#contentRect;
    if (!rect || this.#maxScroll <= 0) return;
    if (pointer.y < rect.y || pointer.y > rect.y + rect.height) return;
    this.#momentum.stop();
    // A vertical mouse wheel is still "scroll the hand" here — there is
    // nothing in this rect to scroll vertically, and a trackpad's horizontal
    // deltaX takes priority when a gesture actually has one. Positive scrolls
    // right (reveals more of the hand), matching a page's own vertical wheel.
    this.scrollBy(deltaX !== 0 ? deltaX : deltaY);
  }

  /**
   * Scrolls just far enough that `drawn` — a slot as it was last drawn, scroll already subtracted — sits wholly
   * inside the row's content rect: keyboard/pad focus moving onto a card that is off the edge of the strip
   * (`scenes/setup-deal.ts#onIntent`) brings it on screen rather than ringing a card the player can't see. A slot
   * already fully visible, or wider than the viewport, leaves the scroll where it is.
   */
  scrollIntoView(drawn: Rect): void {
    const rect = this.#contentRect;
    if (!rect || this.#maxScroll <= 0) return;
    const left = rect.x;
    const right = rect.x + rect.width;
    if (drawn.x < left) this.scrollBy(drawn.x - left);
    else if (drawn.x + drawn.width > right && drawn.width <= rect.width) this.scrollBy(drawn.x + drawn.width - right);
  }
}
