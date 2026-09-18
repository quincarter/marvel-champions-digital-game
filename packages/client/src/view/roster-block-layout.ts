/**
 * The repeating shape S8's roster panel always takes (docs/phase4-screen-gaps.md
 * §2): a search field, a quick-filter chip strip, then the scrolling list —
 * stacked at a given `x`/`y`/`width`. `view/title-layout.ts` computed this
 * inline for both of Title's own rosters before W2 split Scenario select and
 * Take your seats into their own screens; this is the same shape, factored so
 * both new screens (and any later one) stack it without recomputing the three
 * rects by hand.
 *
 * Row/chip heights are the same fixed constants `title-layout.ts` used and for
 * the same reason: a screen needs to know how tall a roster block is *before*
 * a live Phaser scene exists to measure text (`chipRows`/`listRows` are
 * counted by the caller, e.g. `wrapChipsToRows(...).length`, the same input
 * `title-layout.ts` already takes).
 */
import { hit } from "../tokens.js";
import { chipStripHeight } from "./chip-layout.js";
import type { Rect } from "./layout.js";

/**
 * Taller than the base 44px touch target: a roster row is a compact "entity
 * card" (`docs/design-renders/Components_01.png`, "List row" — a thumbnail
 * square, a title, and a subtitle line), not a single line of text.
 */
export const ROSTER_ROW_HEIGHT = 72;

export interface RosterBlockInput {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly chipRows: number;
  readonly listRows: number;
  /** Gap between the search field and the chip strip, and between the chip strip and the list. Defaults to 8. */
  readonly smallGap?: number;
}

export interface RosterBlock {
  readonly search: Rect;
  readonly chips: Rect;
  readonly list: Rect;
  /** Where the next element below this block should start (no trailing gap added — the caller adds its own section gap). */
  readonly bottom: number;
}

export function rosterBlockAt(input: RosterBlockInput): RosterBlock {
  const { x, width } = input;
  const smallGap = input.smallGap ?? 8;
  let y = input.y;
  const search: Rect = { x, y, width, height: hit.target };
  y += hit.target + smallGap;
  const chipsHeight = chipStripHeight(input.chipRows);
  const chips: Rect = { x, y, width, height: chipsHeight };
  y += chipsHeight + smallGap;
  const listHeight = input.listRows * ROSTER_ROW_HEIGHT;
  const list: Rect = { x, y, width, height: listHeight };
  y += listHeight;
  return { search, chips, list, bottom: y };
}
