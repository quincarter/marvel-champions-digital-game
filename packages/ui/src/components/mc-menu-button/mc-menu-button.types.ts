import type { McButtonKind } from "../../shared/button.types.js";
import type { GlyphSpec, McGlyphGround } from "../../shared/glyph.types.js";
import type { SheetRect, SvgOp } from "../../shared/sheet.types.js";

/** A small flat icon on a square grid (a platform mark), drawn in the button's own text colour. */
export interface MenuButtonIcon {
  /** Where the icon sits, in the button's own coordinates. */
  readonly rect: SheetRect;
  /** The grid's side: ops are given in 0 to `grid` on both axes. */
  readonly grid: number;
  /** Shapes: `currentColor` for any paint that should follow the button's text colour. */
  readonly ops: readonly SvgOp[];
  /** Said as a tooltip when a mouse rests on the button, and to assistive tech. */
  readonly label: string;
}

/** A key or pad glyph beside a button's word (`mc-glyph`), placed in the button's own coordinates. */
export interface MenuButtonGlyph {
  readonly x: number;
  readonly y: number;
  readonly specs: readonly GlyphSpec[];
  readonly height: number;
  readonly ground: McGlyphGround;
  /** 0 (folded away) to 1 (open). */
  readonly openness: number;
  readonly still?: boolean;
}

/** One menu button: what it says, how it looks, where it sits and what hangs on it. */
export interface MenuButton {
  /** What `mc-activate` reports, and what a focus stop finds the element by (`data-key`). */
  readonly key: string;
  readonly label: string;
  readonly kind: McButtonKind;
  /** Where the button sits, in its container's coordinates. */
  readonly rect: SheetRect;
  /** Unavailable: dimmed, presses do nothing. */
  readonly disabled?: boolean;
  /** A label that wraps onto a second line rather than being cut (a built game's name). */
  readonly wrap?: boolean;
  /** The label in its own case with no tracking (a row title), else capitals. */
  readonly plain?: boolean;
  /** A Bangers label (a call to action). */
  readonly display?: boolean;
  /** The label's px size. */
  readonly size?: number;
  /** Room kept clear at the button's left edge, so the label centres in what is left (beside an icon). */
  readonly labelInset?: number;
  /** How far the label slides right to make room for a glyph beside it (px). */
  readonly labelShift?: number;
  /** No label slide (reduced motion). */
  readonly still?: boolean;
  /** The keyboard chord that presses this button, as `aria-keyshortcuts`. */
  readonly keyshortcuts?: string;
  /** A count hung on the top right corner ("3"); a picture only, never the button's own control. */
  readonly badge?: string;
  /** A small outlined tag at the right end ("BETA"), decorative. */
  readonly tag?: string;
  readonly icon?: MenuButtonIcon;
  readonly glyph?: MenuButtonGlyph;
}
