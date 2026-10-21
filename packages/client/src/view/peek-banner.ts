/**
 * The compact PEEK AT TABLE banner shared by the full-screen decision sheet (`view/choice-peek.ts`) and the villain
 * phase's own peek (`scenes/villain-phase.ts`), issue #329: on a phone the old banner (88 to 112 px tall) covered the
 * main scheme or the first enemy. Now it is one line (a short question and BACK) with a small control that flips it
 * between the top and the bottom of the free band, and the chosen edge is kept for the session so both banners sit
 * where the player last put them.
 *
 * Pure: the scenes draw into these rectangles. The default edge is the bottom: on a tabbed board (phone, tablet in
 * portrait) the main scheme and the enemy list both start at the top of the tab, and the foot only ever holds the hand.
 */
import { hit } from "../tokens.js";
import { CHROME_HEIGHT, isTabbed, type FormFactor, type Rect } from "./layout.js";

export type PeekEdge = "top" | "bottom";

export interface PeekBannerLayout {
  readonly edge: PeekEdge;
  readonly banner: Rect;
  readonly text: Rect;
  /** MOVE: flips the banner to the other edge. */
  readonly move: Rect;
  readonly back: Rect;
}

const PAD = 4;
const GAP = 8;
/** One line of question and a full-size control, so no taller than a touch target and its padding. */
export const PEEK_BANNER_HEIGHT = hit.target + PAD * 2;

let edge: PeekEdge = "bottom";

/** The edge the player last put the peek banner on (this session; the default is the bottom). */
export function peekEdge(): PeekEdge {
  return edge;
}

export function setPeekEdge(next: PeekEdge): void {
  edge = next;
}

/** MOVE's action: the other edge, remembered. */
export function flipPeekEdge(): PeekEdge {
  edge = edge === "top" ? "bottom" : "top";
  return edge;
}

/** MOVE's label names where the banner goes, in words and an arrow (never the arrow alone). */
export function peekMoveLabel(current: PeekEdge): string {
  return current === "bottom" ? "Top ▴" : "Bottom ▾";
}

/** The top of the free band on a full-screen sheet: under the title bar, and under the tab rail where the board has one. */
export function peekTopClear(formFactor: FormFactor): number {
  const rail = isTabbed(formFactor) && formFactor !== "phoneLandscape" ? hit.target : 0;
  return CHROME_HEIGHT[formFactor] + rail + 4;
}

/**
 * The banner pinned to `edge` of `area` (the band it may use: under the title bar and tab rail at the top, above
 * whatever must stay clear at the bottom), at most `maxWidth` wide, centered.
 */
export function peekBannerLayout(area: Rect, edgeOf: PeekEdge, phone: boolean, maxWidth = 720): PeekBannerLayout {
  const width = Math.min(area.width, maxWidth);
  const x = area.x + (area.width - width) / 2;
  const height = Math.min(PEEK_BANNER_HEIGHT, area.height);
  const banner: Rect = {
    x,
    y: edgeOf === "top" ? area.y : area.y + area.height - height,
    width,
    height,
  };
  const buttonHeight = Math.max(0, height - PAD * 2);
  const backWidth = phone ? 80 : 120;
  const moveWidth = phone ? 76 : 100;
  const y = banner.y + (height - buttonHeight) / 2;
  const back: Rect = { x: banner.x + banner.width - PAD - backWidth, y, width: backWidth, height: buttonHeight };
  const move: Rect = { x: back.x - GAP / 2 - moveWidth, y, width: moveWidth, height: buttonHeight };
  const textX = banner.x + GAP + 2;
  const text: Rect = {
    x: textX,
    y: banner.y,
    width: Math.max(0, move.x - GAP - textX),
    height: banner.height,
  };
  return { edge: edgeOf, banner, text, move, back };
}
