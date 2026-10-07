/**
 * The "other heroes" panel's rows (`scenes/board/zones.ts#drawTeam`), as pure geometry.
 *
 * Every other seat is a row: name, then form / HP / hand on a second line. On the 1440x900 table the panel is tall
 * enough for a caption and a roomy row each, but at 560px tall the band is ~115px, and three other heroes were each
 * given ~26px: the second line was drawn past the row's own bottom edge, over the next row. So the caption gives up
 * its 24px first, and a row never shrinks below what its two lines need (`TEAM_ROW_MIN`); a panel that still cannot
 * hold that many rows (a short phone with three others) falls back to one line per row, name and HP side by side.
 */

import type { Rect } from "./layout.js";

/** The widest a row ever grows: a name, a detail line, status pips and a Team-Up blurb. */
export const TEAM_ROW_MAX = 76;
/** The shortest row that holds a name line and a detail line, each on its own, with their padding. */
export const TEAM_ROW_MIN = 32;
/** A one-line row: the name and the HP on a single line. */
export const TEAM_ROW_LINE = 22;

const HEADER = 24;
const SIDE = 8;
const GAP = 4;
const TIGHT_PAD = 6;
const TIGHT_GAP = 3;

export interface TeamLayout {
  /** Whether the "other heroes" caption is drawn above the rows. */
  readonly header: boolean;
  readonly rows: readonly Rect[];
  /** `lines`: name and detail on separate lines (two when the row is `TEAM_ROW_MIN` or more); `line`: one line. */
  readonly rowStyle: "two-line" | "one-line";
  /** Per row: the strip under it for that seat's usable cards (`view/other-seat-abilities.ts`), or null. */
  readonly chips: readonly (Rect | null)[];
}

/** A row's strip of tappable card chips, and the gap above it. */
export const TEAM_CHIP_HEIGHT = 24;
const CHIP_GAP = 2;

export function teamLayout(rect: Rect, count: number, chipSeats: readonly boolean[] = []): TeamLayout {
  const withChips = chipSeats.filter(Boolean).length;
  if (withChips === 0 || count <= 0)
    return { ...baseLayout(rect, count), chips: Array.from({ length: Math.max(count, 0) }, () => null) };
  // Each seat with cards to show gives up a strip under its row; the rows share what is left.
  const strip = TEAM_CHIP_HEIGHT + CHIP_GAP;
  const base = baseLayout({ ...rect, height: rect.height - strip * withChips }, count);
  let before = 0;
  const rows: Rect[] = [];
  const chips: (Rect | null)[] = [];
  base.rows.forEach((row, index) => {
    const moved = { ...row, y: row.y + before * strip };
    rows.push(moved);
    if (chipSeats[index]) {
      chips.push({ x: moved.x, y: moved.y + moved.height + CHIP_GAP, width: moved.width, height: TEAM_CHIP_HEIGHT });
      before += 1;
    } else chips.push(null);
  });
  return { ...base, rows, chips };
}

function baseLayout(rect: Rect, count: number): Omit<TeamLayout, "chips"> {
  if (count <= 0) return { header: true, rows: [], rowStyle: "two-line" };
  const width = rect.width - SIDE * 2;
  const roomy = Math.min(TEAM_ROW_MAX, (rect.height - 28) / count - GAP);
  if (roomy >= 40) return stacked(rect, width, count, rect.y + HEADER, roomy, GAP, true);
  const tight = Math.min(TEAM_ROW_MAX, (rect.height - TIGHT_PAD * 2 - TIGHT_GAP * (count - 1)) / count);
  const top = rect.y + TIGHT_PAD;
  if (tight >= TEAM_ROW_MIN) return stacked(rect, width, count, top, tight, TIGHT_GAP, false);
  const line = Math.max(14, tight);
  return { ...stacked(rect, width, count, top, line, TIGHT_GAP, false), rowStyle: "one-line" };
}

function stacked(
  rect: Rect,
  width: number,
  count: number,
  top: number,
  height: number,
  gap: number,
  header: boolean,
): Omit<TeamLayout, "chips"> {
  return {
    header,
    rowStyle: "two-line" as const,
    rows: Array.from({ length: count }, (_unused, index) => ({
      x: rect.x + SIDE,
      y: top + index * (height + gap),
      width,
      height,
    })),
  };
}

/** Where the name and detail lines sit inside a row of this height (the roomy rows keep their original offsets). */
export function seatLineOffsets(rowHeight: number): { readonly name: number; readonly detail: number } {
  return rowHeight >= 40 ? { name: 5, detail: 22 } : { name: 3, detail: 17 };
}
