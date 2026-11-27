import type { SheetGlyph } from "../../shared/sheet.types.js";

/** Whose beat a line was: the rule down its left edge. */
export type GameLogVoice = "player" | "villain" | "scenario" | "win" | "loss";

/** A status a line gave or took off, as a chip; `spent` once it has been used up (struck through and faded). */
export interface GameLogTag {
  readonly status: string;
  readonly spent: boolean;
}

/** One line of the log, as the client's `view/log-lines.ts` words it. */
export interface GameLogLine {
  readonly id: string;
  /** The beat reference over the line ("R3.5"). */
  readonly ref: string;
  readonly text: string;
  readonly voice: GameLogVoice;
  readonly tags: readonly GameLogTag[];
}

/** The close button's glyph (the key or pad button the shortcut shows) and how its word makes room, from `SheetGlyphs`. */
export interface GameLogClose {
  readonly labelShift?: number;
  readonly still?: boolean;
  readonly glyph?: SheetGlyph;
}
