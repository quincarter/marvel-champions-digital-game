/**
 * The tabbed hand's scroll/fan state, and the plain rule for whether its
 * "Fan out"/"Collapse" pill earns a place on the board.
 *
 * Pulled out of `scenes/board/hand.ts` on its own: that file also imports
 * Phaser and the widget/theme layer at module scope, so nothing defined
 * inside it can be unit tested without a canvas — exactly the "view models
 * are plain TypeScript tested with Vitest" rule PLAN.md's Phase 4 architecture
 * calls for, and exactly why a real defect here (PLAN.md Phase 4 accessibility
 * bug report, 2026-09-17: "the Fan out pill disappears... and never comes
 * back") had no test standing guard over it. Nothing here imports Phaser.
 */

import type { Rect } from "./layout.js";

/**
 * Whether the tabbed hand's "Fan out"/"Collapse" pill earns a place on the
 * board right now.
 *
 * A hand that already fits at full size has nothing to expand and nowhere to
 * scroll, so the pill hides — but it has to come back the instant the hand
 * crowds again (more cards drawn than fit) or the player already turned fan
 * mode on while it *did* fit (`fannedOut` survives a shrink, so "Collapse"
 * stays reachable even for a hand that would otherwise show nothing). Never
 * shown off the tabbed board, and never while another bar already owns this
 * same strip — payment, a discard-cost pick, or a "play under whose control"
 * choice all draw their own bar directly over the hand's caption row
 * (`scenes/board/hand.ts#drawHand`), and the pill used to keep drawing on top
 * of it regardless, because only the payment bar was ever excluded here.
 */
export function showsFanToggle(tabbed: boolean, barOpen: boolean, canScroll: boolean, fannedOut: boolean): boolean {
  return tabbed && !barOpen && (canScroll || fannedOut);
}

/**
 * The tabbed hand's horizontal scroll and fan state.
 *
 * `cardRow`'s own output never shrinks or shifts for the scroll; the draw
 * subtracts `scrollX` from every slot's `x`, the same separation the phone tabs
 * keep between "what the layout computed" and "what the player is currently
 * looking at."
 */
export class HandScroll {
  readonly #redraw: () => void;
  /** In unscrolled-layout pixels — how far the row has been dragged or scrolled left. */
  #scrollX = 0;
  /** This draw's ceiling for `#scrollX`, re-measured by `drawHand` every draw. */
  #maxScroll = 0;
  /** The hand's own content rect, unscrolled — where a wheel gesture has to land to scroll it. */
  #contentRect: Rect | null = null;
  /** Whether the tabbed hand shows every card at full size (and scrolls further) instead of collapsing the overflow to spines. */
  #fannedOut = false;

  constructor(redraw: () => void) {
    this.#redraw = redraw;
  }

  get scrollX(): number {
    return this.#scrollX;
  }

  get fannedOut(): boolean {
    return this.#fannedOut;
  }

  get canScroll(): boolean {
    return this.#maxScroll > 0;
  }

  /** Records this draw's row, clamping the scroll to what now fits. */
  measure(content: Rect, rowRight: number): void {
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
    this.#redraw();
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

  toggleFan(): void {
    this.#fannedOut = !this.#fannedOut;
    // A fresh view onto whatever shape the row just took, rather than
    // leaving the player scrolled to a position that meant something
    // different a moment ago.
    this.#scrollX = 0;
    this.#redraw();
  }
}
