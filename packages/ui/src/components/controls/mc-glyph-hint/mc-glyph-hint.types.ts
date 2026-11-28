export type { ControlGlyph } from "../../../shared/popup.types.js";

/** Where a hint hangs on its control: inside it at the left, or outside to its left. */
export type McGlyphHintPlace = "inside" | "left";

/** The px a control slides its word over to make room for an inside glyph that is open (half its width and a gap). */
export const glyphLabelShift = (
  glyph: { readonly place?: string; readonly openness: number; readonly width?: number } | undefined,
): number =>
  !glyph || glyph.place === "left" || glyph.openness <= 0 || glyph.width === undefined
    ? 0
    : Math.round(glyph.width / 2 + 4);
