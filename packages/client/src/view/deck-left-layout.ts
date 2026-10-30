/**
 * Geometry of the "Cards left" overlay (`scenes/deck-left.ts`): the pile view's panel and card grid
 * (`view/pile-view-layout.ts`), with the deck tabs and the summary lines between the title bar and the grid.
 */
import { PILE_PAD, pileViewLayout, type PileViewLayout } from "./pile-view-layout.js";
import type { Rect } from "./layout.js";

/** A tab's height: a finger's width. */
export const DECK_LEFT_TAB_HEIGHT = 44;
const GAP = 8;

export interface DeckLeftLayout extends PileViewLayout {
  /** One rect per tab, side by side; none with a single tab. */
  readonly tabs: readonly Rect[];
  readonly summary: Rect;
}

export function deckLeftLayout(
  width: number,
  height: number,
  rows: number,
  tabCount: number,
  summaryHeight: number,
  cardScale = 1,
): DeckLeftLayout {
  const base = pileViewLayout(width, height, rows, cardScale);
  const { x, width: fullWidth } = base.list;
  let y = base.list.y;
  const tabs: Rect[] = [];
  if (tabCount > 1) {
    const tabWidth = Math.floor((fullWidth - GAP * (tabCount - 1)) / tabCount);
    for (let i = 0; i < tabCount; i++)
      tabs.push({ x: x + i * (tabWidth + GAP), y, width: tabWidth, height: DECK_LEFT_TAB_HEIGHT });
    y += DECK_LEFT_TAB_HEIGHT + GAP;
  }
  const summary: Rect = { x, y, width: fullWidth, height: summaryHeight };
  if (summaryHeight > 0) y += summaryHeight + GAP;
  const bottom = base.panel.y + base.panel.height - PILE_PAD;
  return { ...base, tabs, summary, list: { x, y, width: fullWidth, height: Math.max(0, bottom - y) } };
}
