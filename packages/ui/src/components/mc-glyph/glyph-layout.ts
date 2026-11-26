/**
 * The pure half of `mc-glyph`: how wide each cell of a key or button glyph is, and its pad picture made ready to draw
 * inline. The client measures a glyph with `layoutGlyph` to place it beside a label, and `mc-glyph` draws the same
 * layout, so the two can never disagree about a width.
 */

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

export const GLYPH_TAB_WIDTH = 6;
export const GLYPH_CHORD_GAP = 4;
/** A face disc's diameter in picture units: a glyph of height h draws a disc h across. */
export const GLYPH_ART_UNIT = 24.5;
/** The ink outline around a white picture, in picture units. */
export const GLYPH_ART_OUTLINE = 1.5;

/** The font a glyph draws in when the page does not say (the client's body font). */
export const GLYPH_FONT_FAMILY = '"Public Sans", sans-serif';

/** Width in px of `label` set in Public Sans 800 at `size`. */
export type GlyphTextMeasure = (label: string, size: number) => number;

let context: CanvasRenderingContext2D | null | undefined;

/** The default measure: a canvas in the glyph's own font, or a rough per-letter width where there is no canvas. */
export const measureGlyphText = (label: string, size: number, family = GLYPH_FONT_FAMILY): number => {
  if (context === undefined) {
    try {
      context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    } catch {
      context = null;
    }
  }
  const rough = label.length * size * 0.62;
  if (!context) return rough;
  context.font = `800 ${size}px ${family}`;
  const width = context.measureText(label).width;
  return width > 0 ? width : rough;
};

export interface ArtPicture {
  /** The picture's markup between its outer svg tags, placeholders still in. */
  readonly inner: string;
  /** The picture's own box: x, y, width, height. */
  readonly box: readonly [number, number, number, number];
}

/** Reads a raw glyph SVG: its viewBox and what is inside it. */
export function parseArt(source: string): ArtPicture {
  const box = /viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/.exec(source);
  const open = source.indexOf(">", source.indexOf("<svg"));
  const close = source.lastIndexOf("</svg>");
  if (!box || open < 0 || close < 0) throw new Error("Controller glyph picture has no viewBox");
  return {
    inner: source.slice(open + 1, close),
    box: [Number(box[1]), Number(box[2]), Number(box[3]), Number(box[4])],
  };
}

/**
 * The picture's markup recolored and made safe to sit beside others in one document: BODY and CUT become the theme's
 * card and ink fills (as styles, which take `var()`), and every id is prefixed with `uid` (masks and clips are
 * referenced by id, and several glyphs may carry the same picture).
 */
export function artMarkup(inner: string, uid: string): string {
  const ids = [...inner.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]!);
  // One style attribute per element: an element with both a fill and a stroke placeholder keeps both.
  let out = inner.replace(/<[a-zA-Z][^>]*>/g, (tag) => {
    const styles: string[] = [];
    const stripped = tag.replace(/\s(fill|stroke)="(BODY|CUT)"/g, (_all, prop: string, color: string) => {
      styles.push(`${prop}:var(--mc-fill-${color === "BODY" ? "card" : "ink"})`);
      return "";
    });
    if (styles.length === 0) return tag;
    return stripped.replace(/(\/?>)$/, ` style="${styles.join(";")}"$1`);
  });
  for (const id of ids) {
    out = out.replaceAll(`id="${id}"`, `id="${uid}-${id}"`).replaceAll(`url(#${id})`, `url(#${uid}-${id})`);
  }
  return out;
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

/** A picture's drawn size for a glyph of height `h`: an outlined face disc is `h` across and nothing runs past `h`. */
export function artDrawSize(
  picture: ArtPicture,
  colored: boolean,
  h: number,
): { readonly width: number; readonly height: number; readonly scale: number } {
  const pad = colored ? 0 : GLYPH_ART_OUTLINE * 2;
  const width = picture.box[2] + pad;
  const height = picture.box[3] + pad;
  const disc = colored ? GLYPH_ART_UNIT : GLYPH_ART_UNIT + GLYPH_ART_OUTLINE * 2;
  const scale = h / Math.max(disc, height);
  return { width: width * scale, height: height * scale, scale };
}

/** Lays the cells of a glyph of height `height` out as the Phaser `McInputGlyph` measured them. */
export function layoutGlyph(
  specs: readonly GlyphSpec[],
  height: number,
  measure: GlyphTextMeasure = measureGlyphText,
): GlyphLayout {
  const cells = specs.map((spec): LaidCell => {
    if (spec.kind === "pad" && spec.art) {
      const picture = parseArt(spec.art.source);
      const size = artDrawSize(picture, spec.art.colored, height);
      return {
        spec,
        width: size.width,
        height: size.height,
        round: false,
        fontSize: 0,
        art: { picture, outline: spec.art.colored ? 0 : GLYPH_ART_OUTLINE, colored: spec.art.colored },
      };
    }
    if (spec.kind === "pad" && spec.shape === "face") {
      return { spec, width: height, height, round: true, fontSize: Math.round(height * 0.55), art: null };
    }
    const pillHeight = spec.kind === "key" ? height : Math.round(height * 0.85);
    const fontSize = Math.max(8, Math.round(pillHeight * 0.55));
    const minWidth = spec.kind === "key" ? pillHeight : 0;
    const width = Math.max(minWidth, Math.ceil(measure(spec.label, fontSize)) + Math.round(pillHeight * 0.6));
    return { spec, width, height: pillHeight, round: false, fontSize, art: null };
  });
  const fullWidth = cells.reduce((sum, cell, i) => sum + cell.width + (i > 0 ? GLYPH_CHORD_GAP : 0), 0);
  return { cells, fullWidth };
}
