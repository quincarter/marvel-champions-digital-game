/**
 * Scroll position for a single row of variable-width items that scrolls
 * *sideways* — the narrow layouts' quick-filter chip rail (`ui/chip-rail.ts`,
 * Take your seats on phone/tablet portrait). `ListScroll`
 * (`view/list-scroll.ts`) assumes uniform rows and `VariableListScroll`
 * assumes a vertical stack; a chip rail has neither — each chip is as wide as
 * its own label (`view/chip-layout.ts`'s `compactChipWidth`) — so the math
 * here is the plain pixel form of the same idea: a clamped offset over one
 * content extent, kept outside the display list so it survives a scene
 * rebuild the same way every other scroll owner in the app does.
 */

export class RailScroll {
  #offset = 0;

  /** Pixels scrolled from the rail's left edge. */
  get offsetPx(): number {
    return this.#offset;
  }

  reset(): void {
    this.#offset = 0;
  }

  static maxOffset(contentWidth: number, viewportWidth: number): number {
    return Math.max(0, contentWidth - viewportWidth);
  }

  /** Clamps to what `contentWidth` inside a `viewportWidth`-wide rail allows — safe after a filter narrows the chips or the window resizes. */
  clamp(contentWidth: number, viewportWidth: number): void {
    this.#offset = Math.min(Math.max(0, this.#offset), RailScroll.maxOffset(contentWidth, viewportWidth));
  }

  /** Scrolls by `deltaPx` (positive = content moves left, revealing what's to the right). Returns whether the offset changed. */
  scrollByPx(deltaPx: number, contentWidth: number, viewportWidth: number): boolean {
    const before = this.#offset;
    this.#offset += deltaPx;
    this.clamp(contentWidth, viewportWidth);
    return this.#offset !== before;
  }

  /** Scrolls the minimum distance so the span `[x, x + width)` (in content space) is fully visible. Returns whether the offset changed. */
  scrollIntoView(x: number, width: number, contentWidth: number, viewportWidth: number): boolean {
    const before = this.#offset;
    if (x < this.#offset) this.#offset = x;
    else if (x + width > this.#offset + viewportWidth) this.#offset = x + width - viewportWidth;
    this.clamp(contentWidth, viewportWidth);
    return this.#offset !== before;
  }

  /** Whether the rail can still scroll each way — what a caller uses to decide whether to draw a fade or chevron at either edge. */
  edges(contentWidth: number, viewportWidth: number): { readonly left: boolean; readonly right: boolean } {
    return { left: this.#offset > 0.5, right: this.#offset < RailScroll.maxOffset(contentWidth, viewportWidth) - 0.5 };
  }
}

export interface RailItem {
  readonly width: number;
}

/** Each item's content-space x, packed left to right with `gap` between — the one place this arithmetic lives, so the widget and its tests agree. */
export function railItemOffsets(items: readonly RailItem[], gap: number): readonly number[] {
  const xs: number[] = [];
  let x = 0;
  for (const item of items) {
    xs.push(x);
    x += item.width + gap;
  }
  return xs;
}

/** The rail's whole content width: every item plus the gaps between them (none after the last). */
export function railContentWidth(items: readonly RailItem[], gap: number): number {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.width, 0) + (items.length - 1) * gap;
}
