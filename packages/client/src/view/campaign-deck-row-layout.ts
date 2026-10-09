/**
 * The Briefing's Decks panel, one row per seat: "HERO · ASPECT" at the left, the deck count ("40 + 2 pinned") at the
 * right, and a "▸" at the edge. In a narrow panel (a tablet's right column) the two share too little width, so the
 * count drops to a line of its own under the name instead of printing over it. Pure geometry from character-width
 * estimates (the same trade `chip-layout.ts` makes); the scene draws exactly what this returns.
 */

/** Bangers at the row's 16px: a conservative per-character width for an uppercase name. */
const TITLE_CHAR_PX = 9;
/** The count at 14px, per character. */
const COUNT_CHAR_PX = 8.4;
/** Left pad, the gap between the name and the count, and the count's right inset (room for the "▸"). */
const PAD = 12;
const GAP = 12;
const COUNT_RIGHT_INSET = 36;

export const DECK_ROW_HEIGHT = 44;
/** One more line in the row: the count line when stacked, or the wrapped problem text. */
export const DECK_ROW_LINE = 22;

export interface DeckRowLayout {
  /** The count sits under the name instead of beside it. */
  readonly stacked: boolean;
  readonly height: number;
  /** Vertical centers, from the row's top. */
  readonly titleY: number;
  readonly countY: number;
  /** Top of the problem line, from the row's top (null: the row names no problem). */
  readonly problemY: number | null;
}

export function deckRowLayout(width: number, title: string, count: string, hasProblem: boolean): DeckRowLayout {
  const needed = PAD + title.length * TITLE_CHAR_PX + GAP + count.length * COUNT_CHAR_PX + COUNT_RIGHT_INSET;
  const stacked = needed > width;
  if (!stacked) {
    return {
      stacked,
      height: hasProblem ? DECK_ROW_HEIGHT + DECK_ROW_LINE : DECK_ROW_HEIGHT,
      titleY: DECK_ROW_HEIGHT / 2,
      countY: DECK_ROW_HEIGHT / 2,
      problemY: hasProblem ? 36 : null,
    };
  }
  return {
    stacked,
    height: DECK_ROW_HEIGHT + DECK_ROW_LINE + (hasProblem ? DECK_ROW_LINE : 0),
    titleY: 20,
    countY: 20 + DECK_ROW_LINE,
    problemY: hasProblem ? 20 + DECK_ROW_LINE + 18 : null,
  };
}

/** The widest a row's name may be, so it never reaches the count (or, when stacked, the "▸"). */
export function deckRowTitleWidth(width: number, count: string, stacked: boolean): number {
  const right = stacked ? COUNT_RIGHT_INSET : count.length * COUNT_CHAR_PX + COUNT_RIGHT_INSET + GAP;
  return Math.max(60, width - PAD - right);
}
