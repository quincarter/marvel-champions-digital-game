import type { GlyphSpec, McGlyphGround } from "../../shared/glyph.types.js";

/** The glyph a news bar shows beside its link while it has keyboard or pad focus. */
export interface NewsBarGlyph {
  readonly specs: readonly GlyphSpec[];
  readonly height: number;
  readonly ground: McGlyphGround;
  /** 0 (folded away) to 1 (open). */
  readonly openness: number;
  readonly still?: boolean;
}

/** The slim "what's new" strip across the top: its tag, message and link, already worded and translated. */
export interface NewsBarModel {
  /** The caution-yellow tag at the left ("NEW"). */
  readonly tag: string;
  readonly message: string;
  /** The link at the right ("Read more ↗"), or its arrow alone where the strip is too narrow for the words. */
  readonly link: string;
  readonly glyph?: NewsBarGlyph | null;
}
