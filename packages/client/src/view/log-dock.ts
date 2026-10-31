/**
 * Where the game log opens and what it reads (issue #550). The log is no longer a panel on the table: the title bar
 * carries its latest line, and pressing that line (or the log's key, or holding View) opens a larger view with room to
 * read it. On the long table it docks beside the table the way the villain phase does, so the table stays live; on the
 * tabbed layouts it takes the tab area, between the title bar and the hand. Pure: the scenes draw into what this says.
 */
import type { BoardLayout, FormFactor, Rect } from "./layout.js";
import type { LogLine, LogState } from "./log-lines.js";

/** The docked log's width: a bit more than a third of the screen, within readable bounds. */
export function logDockWidthFor(viewportWidth: number): number {
  return Math.round(Math.min(640, Math.max(360, viewportWidth * 0.36)));
}

/** The panel beside the table: right of the hand, which ends where the table does, from the title bar down. */
export function logDockRect(layout: BoardLayout, dockWidth: number): Rect | null {
  const { chrome, hand } = layout.zones;
  if (!chrome || !hand) return null;
  const top = chrome.y + chrome.height;
  return {
    x: hand.x + hand.width,
    y: top,
    width: dockWidth,
    height: layout.viewport.y + layout.viewport.height - top,
  };
}

export interface LogType {
  /** The lines themselves. */
  readonly body: number;
  /** The "R3.5" reference over each line. */
  readonly ref: number;
}

/** The log's type: sized for a phone at arm's length up to a TV across a room. */
export function logTypeFor(formFactor: FormFactor): LogType {
  switch (formFactor) {
    case "desktop":
      return { body: 18, ref: 13 };
    case "tabletLandscape":
    case "tabletPortrait":
      return { body: 17, ref: 13 };
    default:
      return { body: 16, ref: 12 };
  }
}

export interface LogTicker {
  /** What the title bar's line says. */
  readonly text: string;
  /** False during a lesson that keeps the log locked: the line says why and presses do nothing. */
  readonly enabled: boolean;
}

/** The title bar's line: the newest log line, or why the log is shut in a lesson. */
export function logTickerOf(
  log: LogState,
  gate: { readonly locked: boolean; readonly reason: string | null },
): LogTicker {
  if (gate.locked) return { text: `Unlocks after ${gate.reason ?? "this lesson"}`, enabled: false };
  return { text: log.lines.at(-1)?.text ?? "What happens at the table is written here.", enabled: true };
}

/** A beat the villain phase has shown, for the log while the phase replays. */
export interface ShownBeat {
  readonly step: number;
  readonly text: string;
}

/**
 * The beats the log may show. A facedown encounter card waiting on its flip, or turning over, is already the cursor's
 * current beat, which names it: the rail hides that beat, so the log does too (issue #311).
 */
export const shownBeatsOf = (beats: readonly ShownBeat[], facedownPending: boolean): readonly ShownBeat[] =>
  facedownPending ? beats.slice(0, -1) : beats;

/**
 * The log for the view opened inside a villain phase. While the phase replays, the table's log waits where the phase
 * began so it can't give away a card the rail has not shown (issue #311). Reading it there would stop short of the very
 * thing the player went to look up, so the beats the rail has shown follow it.
 */
export function logWithShownBeats(log: LogState, round: number, beats: readonly ShownBeat[]): LogState {
  if (beats.length === 0) return log;
  const shown = beats.map((beat, index): LogLine => ({
    id: `phase-beat-${index}`,
    ref: `R${round} · step ${beat.step}`,
    round,
    text: beat.text,
    tags: [],
    voice: "villain",
  }));
  return { ...log, lines: [...log.lines, ...shown] };
}
