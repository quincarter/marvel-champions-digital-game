/**
 * The Pause overlay's "Jump to a moment" box (D13; owner decision 2026-09-18
 * — see `pause-layout.ts`'s own header): the most recent log lines that fit
 * in the box, newest first (a paused player is most likely looking for what
 * just happened, not the start of the round).
 *
 * The box has no scroll of its own — docs/phase4-screen-gaps.md S7's
 * read-only replay board hasn't landed, so a row here isn't clickable yet
 * either (`scenes/pause.ts` draws it plainly) — so this picks exactly as
 * many lines as fit and stops there, the same "don't clip, don't overflow"
 * rule `view/layout.ts`'s `estimateWrappedLines` already serves for every
 * other wrapped-text row in this app.
 */
import { estimateWrappedLines } from "./layout.js";
import type { LogLine } from "./log-lines.js";

const LINE_HEIGHT = 13;
const LINE_GAP = 6;
/** Public Sans body's own average glyph width at the small size this box draws at — matches `toggleRowHeight`'s own estimate convention. */
const CHAR_WIDTH = 5;

export interface LogMoment {
  readonly line: LogLine;
  /** This line's own drawn height, including the gap that follows it — what the caller advances its cursor by. */
  readonly height: number;
}

/**
 * `lines` in their natural oldest-to-newest order (`LogState.lines`); returned
 * newest first, truncated to whatever fits in `availableHeight` px at
 * `textWidth` px wide. Always includes at least the newest line, even if it
 * alone doesn't fit — the same "still better shown than skipped" rule
 * `log-view.ts`'s own `windowEndingAt` states for the on-table log panel.
 */
export function recentLogMoments(
  lines: readonly LogLine[],
  availableHeight: number,
  textWidth: number,
): readonly LogMoment[] {
  const newestFirst = [...lines].reverse();
  const moments: LogMoment[] = [];
  let used = 0;
  for (const line of newestFirst) {
    const wrapped = Math.max(1, estimateWrappedLines(line.text, textWidth, CHAR_WIDTH));
    const height = wrapped * LINE_HEIGHT + LINE_GAP;
    if (moments.length > 0 && used + height > availableHeight) break;
    moments.push({ line, height });
    used += height;
  }
  return moments;
}
