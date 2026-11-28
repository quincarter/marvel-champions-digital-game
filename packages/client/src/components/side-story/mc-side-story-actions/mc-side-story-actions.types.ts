import type { HintGlyph } from "@mc/ui";

export interface McSideStoryActionsProps {
  /** Not the first beat: BACK shows. */
  hasBack: boolean;
  /** "◂ BACK". */
  backLabel: string;
  /** "NEXT ▸", or "DONE ▸" on the last beat. */
  nextLabel: string;
  /** The Activate glyph on NEXT; null on touch or a mouse. */
  nextGlyph: HintGlyph | null;
  /** A phone: a shorter bar and a narrower BACK. */
  compact: boolean;
}
