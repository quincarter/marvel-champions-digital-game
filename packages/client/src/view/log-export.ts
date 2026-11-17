/**
 * A game's log as a text file (issue #693's "Export log"): every line the board's log would show, uncapped, under a
 * short heading. Pure: the replay worker folds the game's whole history through `appendEvents` and hands the lines here.
 */
import type { EngineDeps, GameEvent, GameState } from "@mc/engine";
import { appendEvents, emptyLog, plainLogLine, type LogLine } from "./log-lines.js";

/** The heading's facts: the game as lists name it ("Rhino · Spider-Man"), its difficulty, result and day. */
export interface LogHeading {
  readonly game: string;
  readonly difficulty: string | null;
  readonly result: string | null;
  readonly playedAt: number;
  /**
   * The game was changed by hand (Pause ▸ Manual adjust) or undone past a draw, reveal or random pick (`SaveMeta.adjusted`,
   * issue #791): the file says so up top, so a log shared with a bug report isn't read as a game played by the rules.
   */
  readonly adjusted?: boolean;
}

/** What an exported log or an issue report says about an adjusted game (issue #791). */
export const ADJUSTED_LOG_LINE =
  "Adjusted: yes. This game was changed by hand (Manual adjust) or undone past a draw, reveal or random pick, so it is not the game as the rules played it, and it doesn't count toward stats or achievements.";

/** Every log line of a game: its history folded in one pass with no cap, names read from `state`'s card pool. */
export function fullLogLines(history: readonly GameEvent[], state: GameState, deps: EngineDeps): readonly LogLine[] {
  return appendEvents(emptyLog(), history, state, null, deps, Number.POSITIVE_INFINITY).lines;
}

/** The file's text: the heading, a blank line, then one line per beat as `R3.5  text`. */
export function logText(heading: LogHeading, lines: readonly LogLine[]): string {
  const head = [
    `Marvel Champions: ${heading.game}${heading.difficulty ? ` (${heading.difficulty})` : ""}`,
    ...(heading.result ? [`Result: ${heading.result}`] : []),
    ...(heading.adjusted ? [ADJUSTED_LOG_LINE] : []),
    `Played: ${new Date(heading.playedAt).toISOString().slice(0, 10)}`,
  ];
  const width = Math.max(0, ...lines.map((line) => line.ref.length));
  const body = lines.map((line) => `${line.ref.padEnd(width)}  ${plainLogLine(line).text}`);
  return `${[...head, "", ...body].join("\n")}\n`;
}
