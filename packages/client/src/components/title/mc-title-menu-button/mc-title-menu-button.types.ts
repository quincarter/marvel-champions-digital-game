import type { McButtonKind, SvgOp } from "@mc/ui";
import type { TitleGlyph } from "../shared/title.types.js";

/** A small flat mark (where the game was last played) in the row, drawn in the row text colour. */
export interface TitleRowIcon {
  /** The grid the ops are given in (0 to `grid` on both axes). */
  readonly grid: number;
  readonly ops: readonly SvgOp[];
  /** Said as a tooltip when a mouse rests on the row, and to assistive tech. */
  readonly label: string;
}

/** One row of the Title menu, already translated. */
export interface TitleMenuRow {
  /** Its focus stop and what a press reports (`continue`, `new-game`, `decks`, ...). */
  readonly key: string;
  readonly label: string;
  readonly kind: McButtonKind;
  /** A full row, or half of a row beside another. */
  readonly width: "full" | "half";
  /** The primary height (52px) rather than the touch target (44px). */
  readonly tall?: boolean;
  /** Dimmed; a press does nothing. */
  readonly disabled?: boolean;
  /** The label wraps onto a second line rather than being cut (a built game name). */
  readonly wrap?: boolean;
  /** A Bangers label (a call to action). */
  readonly display?: boolean;
  /** A label in its own case (default), or capitals. */
  readonly plain?: boolean;
  /** The label size in px. */
  readonly size?: number;
  /** A count hung on the top right corner ("3"). */
  readonly badge?: string;
  /** A small outlined tag at the right end ("BETA"). */
  readonly tag?: string;
  readonly icon?: TitleRowIcon;
  /** The press glyph beside the label while the row has focus. */
  readonly glyph?: TitleGlyph;
}
