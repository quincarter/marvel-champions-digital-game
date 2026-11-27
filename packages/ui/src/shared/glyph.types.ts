/** Which ground a glyph sits on: the ink panel or the paper card. */
export type McGlyphGround = "ink" | "paper";

/** The PlayStation face symbols the fonts lack: drawn as shapes. */
export type GlyphSymbol = "cross" | "circle" | "square" | "triangle";

export interface GlyphKeySpec {
  readonly kind: "key";
  readonly label: string;
}

export interface GlyphPadArt {
  /** The family's picture of this button: raw SVG with its BODY / CUT placeholders. Trusted, bundled SVG only: it is drawn as markup. */
  readonly source: string;
  /** Xbox / PlayStation face buttons keep their own colors, with no outline. */
  readonly colored: boolean;
}

export interface GlyphPadSpec {
  readonly kind: "pad";
  readonly label: string;
  /** "face" is a round disc; every other shape is a square pill. */
  readonly shape: string;
  readonly symbol?: GlyphSymbol | null;
  /** Xbox face letters only: the letter's CSS color, drawn on an ink disc. */
  readonly color?: string;
  /** The picture drawn in place of the shape, where the family's set has one. */
  readonly art?: GlyphPadArt;
}

export type GlyphSpec = GlyphKeySpec | GlyphPadSpec;

/** Width in px of `label` set in Public Sans 800 at `size`. */
export type GlyphTextMeasure = (label: string, size: number) => number;

export interface ArtPicture {
  /** The picture's markup between its outer svg tags, placeholders still in. */
  readonly inner: string;
  /** The picture's own box: x, y, width, height. */
  readonly box: readonly [number, number, number, number];
}

export interface LaidCell {
  readonly spec: GlyphSpec;
  readonly width: number;
  readonly height: number;
  readonly round: boolean;
  /** The label's font size in px. */
  readonly fontSize: number;
  readonly art: { readonly picture: ArtPicture; readonly outline: number; readonly colored: boolean } | null;
}

export interface GlyphLayout {
  readonly cells: readonly LaidCell[];
  /** The width when fully open: the cells and the gaps between them. */
  readonly fullWidth: number;
}
