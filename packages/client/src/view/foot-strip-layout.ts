/**
 * How tall a foot strip (the ink bar carrying a card's `▶` ability line, a note or a threat line) needs to be for
 * its text. A line that does not fit on one row wraps to a second line and the strip grows to hold it, rather than
 * ending in an ellipsis ("▶ SKIN CONT…" for Skin Contact). Two lines is the limit: the strip names the ability, it
 * never carries its rules text (that is the Inspect pop-up's job). Only if two lines still do not fit does the font
 * drop one size step; a third line is never drawn.
 *
 * Widths are estimates (the scene wraps with the real font metrics and only reads these to reserve height), kept a
 * little high on purpose so the strip is never reserved too short.
 */

/** A single-row strip's height. */
export const FOOT_STRIP_HEIGHT = 18;
/** What each extra wrapped line adds. */
const EXTRA_LINE = 12;
/** Roughly one uppercase 9 px caption character, letter spacing included. */
const CHAR_WIDTH = 7.2;
/** The caption at one size step smaller. */
const SMALLER_CHAR_WIDTH = 6.4;
/** Left bar, padding and a little slack, the same `12` `drawFootStrip` takes off the width. */
const STRIP_PADDING = 12;

export interface FootStripLayout {
  /** 1 or 2: the lines the strip is drawn with. */
  readonly lines: 1 | 2;
  readonly height: number;
  /** Two lines did not fit at the caption size, so the font drops one step. */
  readonly smaller: boolean;
  /** Even the smaller size needs a third line: the scene clips there, and the full text is the Inspect pop-up's. */
  readonly clipped: boolean;
}

function linesFor(text: string, capacity: number): number {
  let lines = 1;
  let used = 0;
  for (const word of text.trim().split(/\s+/)) {
    const length = word.length;
    if (used === 0) {
      used = length;
    } else if (used + 1 + length <= capacity) {
      used += 1 + length;
    } else {
      lines += 1;
      used = length;
    }
    // A single word longer than a line breaks across lines.
    if (used > capacity) {
      lines += Math.ceil(used / capacity) - 1;
      used = used % capacity || capacity;
    }
  }
  return lines;
}

/** The strip's lines and height for `text` in a strip `width` wide (less `tagWidth` if it carries a right-edge tag). */
export function footStripLayout(text: string, width: number, tagWidth = 0): FootStripLayout {
  const room = Math.max(24, width - STRIP_PADDING - tagWidth);
  const normal = linesFor(text, Math.max(4, Math.floor(room / CHAR_WIDTH)));
  if (normal <= 1) return { lines: 1, height: FOOT_STRIP_HEIGHT, smaller: false, clipped: false };
  // Two lines at the normal size, else the same two lines one size step smaller (the scene clips a third).
  const small = linesFor(text, Math.max(4, Math.floor(room / SMALLER_CHAR_WIDTH)));
  return { lines: 2, height: FOOT_STRIP_HEIGHT + EXTRA_LINE, smaller: normal > 2, clipped: normal > 2 && small > 2 };
}
