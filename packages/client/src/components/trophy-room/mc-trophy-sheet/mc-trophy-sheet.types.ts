import type { ControlGlyph } from "@mc/ui";

/** One achievement spelled out in full: the whole line, unclipped. */
export interface TrophySheetModel {
  readonly name: string;
  /** "✓ EARNED   +25 points   From Silly pack   Progress 4 / 10": the state, reward, pack and count in one line. */
  readonly facts: string;
  /** What it takes, in full. */
  readonly detail: string;
  readonly closeLabel: string;
  /** B (Escape) on the Close button, or undefined for none. */
  readonly closeGlyph: ControlGlyph | undefined;
}

export interface McTrophySheetProps {
  readonly model: TrophySheetModel | null;
}
