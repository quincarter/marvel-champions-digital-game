/**
 * PEEK AT TABLE on the full-screen decision sheet (#231, the owner's follow-up: She-Hulk's "Do You Even Lift?" target
 * pick covered the table as the villain phase's decisions used to). The sheet steps aside for a banner at the foot of
 * the screen that keeps the question and a way back, and the table above it is the player's to look over, tabs and
 * all, until they go back to the decision.
 *
 * Pure: `scenes/choice.ts` draws into these rectangles. While a sheet is peeking, `choicePeeking()` says so, so the
 * Board's hover popover works over the table as it does beside a docked sheet (`scenes/board.ts`).
 */
import { hit } from "../tokens.js";
import type { FormFactor, Rect } from "./layout.js";

export interface ChoicePeekBannerLayout {
  readonly banner: Rect;
  readonly text: Rect;
  readonly back: Rect;
}

const INSET = 8;
const PAD = 12;

/** The banner at the foot of the screen, over the action bar, so the hand above it stays in view. */
export function choicePeekBannerLayout(viewport: Rect, formFactor: FormFactor): ChoicePeekBannerLayout {
  const phone = formFactor === "phone" || formFactor === "phoneLandscape";
  const height = phone ? 88 : 76;
  const width = Math.min(viewport.width - INSET * 2, 720);
  const banner: Rect = {
    x: viewport.x + (viewport.width - width) / 2,
    y: viewport.y + viewport.height - INSET - height,
    width,
    height,
  };
  const backWidth = Math.round(Math.min(220, Math.max(130, width * 0.38)));
  const back: Rect = {
    x: banner.x + banner.width - PAD - backWidth,
    y: banner.y + (banner.height - Math.max(hit.target, height - PAD * 2)) / 2,
    width: backWidth,
    height: Math.max(hit.target, height - PAD * 2),
  };
  const text: Rect = {
    x: banner.x + PAD,
    y: banner.y + PAD,
    width: Math.max(0, back.x - PAD - (banner.x + PAD)),
    height: banner.height - PAD * 2,
  };
  return { banner, text, back };
}

/** The thumb strip PEEK AT TABLE takes under the sheet on a tabbed layout: a full-size control and its gap. */
export const CHOICE_PEEK_STRIP = hit.target + 12;

/** PEEK AT TABLE's place in the sheet's title bar, at its right end (left of Back out when that is there too). */
export function choicePeekButtonRect(bar: Rect, rightEdge: number, phone: boolean): Rect {
  const width = phone ? 84 : 132;
  const height = Math.min(28, bar.height - 10);
  return { x: rightEdge - width, y: bar.y + (bar.height - height) / 2, width, height };
}

/** The peek control's label: short on a phone's narrow title bar. */
export function choicePeekLabel(phone: boolean): string {
  return phone ? "Peek ▾" : "Peek at table ▾";
}

let peeking = false;

export function setChoicePeeking(next: boolean): void {
  peeking = next;
}

/** True while the decision sheet has stepped aside for its banner. */
export function choicePeeking(): boolean {
  return peeking;
}

/** COLLAPSE's place in the sheet's title bar, at its right end, when the sheet was EXPANDed out of a dock. */
export function choiceCollapseButtonRect(bar: Rect, rightEdge: number): Rect {
  const width = 104;
  const height = Math.min(28, bar.height - 10);
  return { x: rightEdge - width, y: bar.y + (bar.height - height) / 2, width, height };
}

export interface DefendHeaderControls {
  readonly peek: Rect | null;
  readonly collapse: Rect | null;
  /** The left edge of the controls, or null with none: the title and the authority tag stay clear of it. */
  readonly left: number | null;
}

/**
 * PEEK AT TABLE and COLLAPSE at the right end of the full-screen defend sheet's header, when the docked villain phase
 * offers them (#231). Vertically on the header's title line, which sits under its eyebrow.
 */
export function defendHeaderControls(
  header: Rect,
  offer: { readonly peek: boolean; readonly collapse: boolean; readonly phone: boolean },
): DefendHeaderControls {
  const height = Math.min(32, Math.max(24, header.height - 28));
  const y = header.y + header.height / 2 + 10 - height / 2;
  const peekWidth = offer.phone ? 84 : 132;
  const collapseWidth = offer.phone ? 92 : 104;
  let right = header.x + header.width - 12;
  let collapse: Rect | null = null;
  let peek: Rect | null = null;
  if (offer.collapse) {
    collapse = { x: right - collapseWidth, y, width: collapseWidth, height };
    right = collapse.x - 8;
  }
  if (offer.peek) {
    peek = { x: right - peekWidth, y, width: peekWidth, height };
    right = peek.x - 8;
  }
  return { peek, collapse, left: peek || collapse ? right + 8 : null };
}
