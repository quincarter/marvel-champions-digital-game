import type { HintGlyph } from "@mc/ui";

export interface McSideStoryHeaderProps {
  /** "SIDE STORY". */
  label: string;
  /** The story's title, in capitals. */
  title: string;
  /** The story's credit line. */
  credit: string;
  /** "CLOSE ✕". */
  closeLabel: string;
  /** The Start glyph on CLOSE; null on touch or a mouse. */
  closeGlyph: HintGlyph | null;
  /** A phone: smaller title, credit and button. */
  compact: boolean;
}
