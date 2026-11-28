import type { ThemeTabBox } from "./theme-tab.js";

/** The room kept between the tab and a title (px), beside it and under it. */
export const TAB_GAP = 8;

/** A bar narrower than this (px) is a phone's: its title always drops to its own row under the tab. */
export const NARROW_BAR = 600;

/** What the rule needs to know about a bar, all in the bar's own px from its left edge. */
export interface TitleClearanceInput {
  /** The bar's width. */
  readonly barWidth: number;
  /** Where the title would start in the bar's first row (after Back and its gap). */
  readonly titleLeft: number;
  /** The title's width set on one line at its own size: never shrunk, never cut. */
  readonly titleWidth: number;
  /** The right edge the first row's title may reach (before the caption and the end slot). */
  readonly rowRight: number;
  /** The dark mode tab, in the bar's own px from its top-left corner, or null while it is hidden. */
  readonly tab: ThemeTabBox | null;
}

export interface TitleClearance {
  /** The title sits on its own row under the tab, whole (else it stays in the first row beside Back). */
  readonly dropped: boolean;
  /** When dropped, how far down the first row reaches so the title's row starts under the tab (0 otherwise). */
  readonly firstRow: number;
}

/**
 * The one clearance rule for the dark mode tab. A title never shrinks, is never cut and never runs under the tab:
 * - no tab (hidden, or wholly above the bar): it stays in the first row if it fits there, else it drops to its own row;
 * - a narrow bar (a phone, under `NARROW_BAR`) with the tab up: it drops, whatever its length;
 * - a wide bar: it stays in the first row when the whole of it ends `TAB_GAP` before the tab (or starts after it), else it
 *   drops to its own row under the tab.
 * Pure, so it is tested without a layout.
 */
export function titleClearance(input: TitleClearanceInput): TitleClearance {
  const { barWidth, titleLeft, titleWidth, rowRight } = input;
  // A tab that ends above the bar (with its gap) is no business of this bar.
  const tab = input.tab && input.tab.bottom + TAB_GAP > 0 ? input.tab : null;
  const keep: TitleClearance = { dropped: false, firstRow: 0 };
  if (tab && barWidth < NARROW_BAR) return { dropped: true, firstRow: Math.ceil(tab.bottom + TAB_GAP) };
  const titleRight = titleLeft + titleWidth;
  let limit = rowRight;
  if (tab && tab.right + TAB_GAP > titleLeft) limit = Math.min(limit, tab.left - TAB_GAP);
  if (titleRight <= limit) return keep;
  return { dropped: true, firstRow: tab ? Math.ceil(tab.bottom + TAB_GAP) : 0 };
}
