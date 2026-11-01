/**
 * Where the Balanced prompt's columns and side pane sit (`scenes/campaign/balanced.ts` draws into them). Pure and
 * Vitest-tested.
 *
 * Three layouts, because a tablet is its own layout and not a small desktop:
 *  - phone (under 700 wide): one column; the pane stacks at the bottom of the scrolling body.
 *  - tablet (700 to 999, portrait): the choice on the left, the pane flush to the right edge and as tall as the body.
 *  - wide (1000 and up, the tablet in landscape and the desktop): the same split with a wider choice column and a
 *    pane whose text is capped so lines stay readable.
 * Heights are not known here (text wraps in the scene); the body scrolls when a column runs past the action bar.
 */
export const PHONE_MAX_WIDTH = 700;
export const WIDE_MIN_WIDTH = 1000;

export interface BalancedColumn {
  readonly x: number;
  readonly width: number;
}

export interface BalancedLayout {
  readonly kind: "phone" | "tablet" | "wide";
  /** The choice: heading, why, the two options, the credit. */
  readonly primary: BalancedColumn;
  /** The coloured pane's full extent, flush to the right edge; null on a phone, where it stacks below the choice. */
  readonly pane: BalancedColumn | null;
  /** Where the pane's text goes (a phone: the same column as the choice). */
  readonly paneInner: BalancedColumn;
  /** Body text size in px. */
  readonly textSize: number;
  /** A heading's size in px. */
  readonly headingSize: number;
  readonly gap: number;
}

export function balancedLayoutOf(width: number, gutter: number): BalancedLayout {
  if (width < PHONE_MAX_WIDTH) {
    const primary = { x: gutter, width: width - gutter * 2 };
    return { kind: "phone", primary, pane: null, paneInner: primary, textSize: 13, headingSize: 18, gap: 14 };
  }
  if (width < WIDE_MIN_WIDTH) {
    const leftWidth = Math.floor((width - gutter * 3) * 0.46);
    const paneX = gutter * 2 + leftWidth;
    const padLeft = 20;
    return {
      kind: "tablet",
      primary: { x: gutter, width: leftWidth },
      pane: { x: paneX, width: width - paneX },
      paneInner: { x: paneX + padLeft, width: width - paneX - padLeft - gutter },
      textSize: 14,
      headingSize: 19,
      gap: 16,
    };
  }
  const leftWidth = Math.min(560, Math.max(400, Math.floor(width * 0.4)));
  const paneX = gutter * 2 + leftWidth;
  const pad = 28;
  return {
    kind: "wide",
    primary: { x: gutter, width: leftWidth },
    pane: { x: paneX, width: width - paneX },
    paneInner: { x: paneX + pad, width: Math.min(620, width - paneX - pad * 2) },
    textSize: width >= 1400 ? 15 : 14,
    headingSize: 20,
    gap: 18,
  };
}
