/**
 * Where the Balanced prompt's columns sit (`scenes/campaign/balanced.ts` draws into them). Pure and Vitest-tested.
 *
 * Three layouts, because a tablet is its own layout and not a small desktop:
 *  - phone (under 640 wide): one full-width column.
 *  - tablet portrait (640 to 999): one centred column, capped so the lines stay readable.
 *  - wide (1000 and up, the tablet in landscape and the desktop): two columns, the choice and its credit on the left,
 *    what Rebalance changes and its toggles on the right, so the toggles are on screen beside the choice.
 * Heights are not known here (text wraps in the scene); the body scrolls when the columns run past the action bar.
 */
export const PHONE_MAX_WIDTH = 640;
export const WIDE_MIN_WIDTH = 1000;
const SINGLE_COLUMN_MAX = 680;
const WIDE_MAX = 1120;

export interface BalancedColumn {
  readonly x: number;
  readonly width: number;
}

export interface BalancedLayout {
  readonly kind: "phone" | "tablet-portrait" | "wide";
  /** The first column, or the only one. */
  readonly primary: BalancedColumn;
  /** The second column, on a wide screen only. */
  readonly secondary: BalancedColumn | null;
  /** Body text size in px. */
  readonly textSize: number;
  /** A heading's size in px. */
  readonly headingSize: number;
  readonly gap: number;
}

export function balancedLayoutOf(width: number, gutter: number): BalancedLayout {
  if (width < PHONE_MAX_WIDTH) {
    return {
      kind: "phone",
      primary: { x: gutter, width: width - gutter * 2 },
      secondary: null,
      textSize: 13,
      headingSize: 18,
      gap: 14,
    };
  }
  if (width < WIDE_MIN_WIDTH) {
    const columnWidth = Math.min(SINGLE_COLUMN_MAX, width - gutter * 2);
    return {
      kind: "tablet-portrait",
      primary: { x: Math.round((width - columnWidth) / 2), width: columnWidth },
      secondary: null,
      textSize: 15,
      headingSize: 20,
      gap: 18,
    };
  }
  const total = Math.min(WIDE_MAX, width - gutter * 2);
  const gap = 32;
  const columnWidth = Math.floor((total - gap) / 2);
  const left = Math.round((width - total) / 2);
  return {
    kind: "wide",
    primary: { x: left, width: columnWidth },
    secondary: { x: left + columnWidth + gap, width: columnWidth },
    textSize: width >= 1400 ? 16 : 14,
    headingSize: 20,
    gap: 18,
  };
}
