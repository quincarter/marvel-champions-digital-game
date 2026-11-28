import type { GlyphSpec, McGlyphGround } from "../../shared/glyph.types.js";

/** The key or pad glyph a button carries beside its word (nothing on touch: the client hands none). */
export interface HintGlyph {
  readonly specs: readonly GlyphSpec[];
  /** The glyph height in px, already scaled by the hint size setting. */
  readonly height: number;
  /** The ground it sits on: the ink panel or the paper card. */
  readonly ground: McGlyphGround;
  /** A keyboard or pad is moving (open) or the mouse is (folded to a tab). */
  readonly expanded: boolean;
  /** No open / close transition (reduced motion). */
  readonly still: boolean;
}
