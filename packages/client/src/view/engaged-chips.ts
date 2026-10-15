/**
 * The chips hung over a minion tile's top edge: "vs SPIDER-MAN" (who it is engaged with, when more than one seat
 * plays), "HELD" / "CAPTIVE" (a character a card holds, engaged with nobody) and "GUARD OFF" (a keyword that does
 * nothing while it is held). They sit wholly above the tile, never over its title or the card above it, so the row of
 * tiles reserves the headroom they need (`engagedChipHeadroom`) instead of letting them land on a neighbor's text.
 * Plain geometry and wording; the scene draws them.
 */
import { inactiveKeywordNote } from "./keyword-tags.js";

/** One chip line's height, and the gap the stack keeps above its tile. */
export const CHIP_LINE_HEIGHT = 11;
export const CHIP_PAD = 4;
export const CHIP_GAP = 2;
/** A chip bounded to its tile wraps onto at most this many lines. */
export const CHIP_MAX_LINES = 2;
/** What one uppercase caption character takes at the caption floor with its letter spacing taken off (a high estimate). */
const CHIP_CHAR_WIDTH = 5.8;
/** The caution bar a held chip carries at its left edge, and the chip's padding either side of its text. */
export const CHIP_BAR = 4;
export const CHIP_TEXT_PAD = 8;

/** What one uppercase character of the engaged chip takes at the caption floor, tracking off, as measured on a desktop tile ("VS WONDER M…" was cut at 88 px). */
const ENGAGED_CHAR_WIDTH = 7.4;
/** The width an engaged chip may take on a tile: the tile less a margin, but never less than this. */
export const ENGAGED_CHIP_MIN_ROOM = 88;

export interface EngagedChipRow {
  readonly words: string;
  /** A row about this very tile never leaves it (wraps instead); "vs X" may be wider than a small tile. */
  readonly bounded: boolean;
  readonly bar: number;
}

interface MinionChipFacts {
  readonly heldBy: { readonly kind: "held" | "captive" } | null;
  readonly engagedName: string | null;
  readonly inactiveKeywords: readonly string[];
}

/**
 * "vs Wonder Man", or its short form "vs W. Man" when the whole would be cut on a tile `tileWidth` wide: every word but
 * the last becomes an initial ("Captain Marvel" is "C. Marvel", "Spider-Man" is "S.-Man"). A name that is one word, or
 * still too long short, stays whole: the scene may cut it, but never a name that fits.
 */
export function engagedChipWords(name: string, tileWidth: number): string {
  const room = Math.max(ENGAGED_CHIP_MIN_ROOM, tileWidth - 14);
  const whole = `vs ${name}`;
  if (whole.length * ENGAGED_CHAR_WIDTH <= room) return whole;
  // An alter-ego seat reads "Spider-Man (Peter Parker)": the other name is dropped before any initials are made, so the
  // chip never reads "S.-M. (. PARKER)".
  const base = name.replace(/\s*\([^)]*\)\s*$/, "") || name;
  if (base !== name && `vs ${base}`.length * ENGAGED_CHAR_WIDTH <= room) return `vs ${base}`;
  const parts = base.split(/([\s-]+)/);
  const lastWord = parts.length - 1;
  const short = parts
    .map((part, index) => (index < lastWord && index % 2 === 0 && part !== "" ? `${part[0]}.` : part))
    .join("");
  return `vs ${short}`;
}

/** The rows a minion carries without counting a keyword tag a tile had no room for (that one is known only when drawn). */
export function engagedChipRows(
  minion: MinionChipFacts,
  maxRows = Infinity,
  tileWidth = Infinity,
): readonly EngagedChipRow[] {
  const held = minion.heldBy;
  const words = held ? held.kind : minion.engagedName;
  const offNote = held ? inactiveKeywordNote(minion.inactiveKeywords) : null;
  return [
    ...(words
      ? [{ words: held ? words : engagedChipWords(words, tileWidth), bounded: held !== null, bar: held ? CHIP_BAR : 0 }]
      : []),
    ...(offNote ? [{ words: offNote, bounded: true, bar: CHIP_BAR }] : []),
  ].slice(0, maxRows);
}

/**
 * How many lines a row needs on a tile `tileWidth` wide: a bounded row stays on one line when it fits whole at the
 * caption floor (letter spacing taken off), else wraps onto two; any other row stays on one.
 */
export function chipLinesFor(row: EngagedChipRow, tileWidth: number): number {
  if (!row.bounded) return 1;
  const room = Math.max(24, tileWidth - 4 - row.bar - CHIP_TEXT_PAD);
  return row.words.length * CHIP_CHAR_WIDTH <= room ? 1 : CHIP_MAX_LINES;
}

export const chipHeight = (lines: number): number => lines * CHIP_LINE_HEIGHT + CHIP_PAD;

/** The vertical room one minion's stack needs above its tile. */
export function engagedChipStackHeight(minion: MinionChipFacts, tileWidth: number, maxRows = Infinity): number {
  const rows = engagedChipRows(minion, maxRows);
  if (rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + chipHeight(chipLinesFor(row, tileWidth)) + CHIP_GAP, 0);
}

/** The headroom a row of tiles reserves above itself: the tallest stack of any minion in it, 0 when none carries a chip. */
export function engagedChipHeadroom(
  minions: readonly MinionChipFacts[],
  tileWidth: number,
  maxRows = Infinity,
): number {
  return minions.reduce((most, minion) => Math.max(most, engagedChipStackHeight(minion, tileWidth, maxRows)), 0);
}

/** The shortest a minion tile may be squeezed to by its chips before the secondary chip gives way. */
export const CHIP_MIN_TILE_HEIGHT = 100;
/** The gap a row of tiles keeps under the villain band anyway; headroom only costs what it adds beyond this. */
const ROW_GAP = 8;

export interface SettledChipRoom {
  /** The height the chips need above the row (at least `ROW_GAP` is the row's own gap, so callers take the max). */
  readonly room: number;
  /** All rows (Infinity) or just the primary one, when the full stack would squeeze the tiles below `CHIP_MIN_TILE_HEIGHT`. */
  readonly maxRows: number;
}

/**
 * How much room the chips take above a row of minion tiles, given the height the row has (`available`, under the
 * villain band and the zone's foot margin) and how wide a tile comes out at a given row height. The tiles get
 * narrower as the headroom takes height, which can wrap a chip onto a second line, so the headroom is measured again
 * on the shrunken row (two passes settle it). When the full stack would leave tiles under `CHIP_MIN_TILE_HEIGHT`
 * (1024x768 beside a tall environment), only the primary chip ("held", "vs Spider-Man") stays: the dimmed "guard off"
 * note is one tap away in Inspect, and a row of tiles too small to read is worse.
 */
export function settleChipRoom(
  minions: readonly MinionChipFacts[],
  available: number,
  tileWidthAt: (rowHeight: number) => number,
): SettledChipRoom {
  const attempt = (maxRows: number): SettledChipRoom => {
    let room = engagedChipHeadroom(minions, tileWidthAt(available), maxRows);
    for (let pass = 0; pass < 2; pass += 1) {
      const rowHeight = available - Math.max(0, room - ROW_GAP);
      room = Math.max(room, engagedChipHeadroom(minions, tileWidthAt(rowHeight), maxRows));
    }
    return { room, maxRows };
  };
  const full = attempt(Infinity);
  if (available - Math.max(0, full.room - ROW_GAP) >= CHIP_MIN_TILE_HEIGHT) return full;
  return attempt(1);
}
