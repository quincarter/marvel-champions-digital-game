/**
 * The pure half of `mc-glyph`: how wide each cell of a key or button glyph is, and its pad picture made ready to draw
 * inline. The client measures a glyph with `layoutGlyph` to place it beside a label, and `mc-glyph` draws the same
 * layout, so the two can never disagree about a width.
 */

import type { ArtPicture, GlyphLayout, GlyphSpec, GlyphTextMeasure, LaidCell } from "../../shared/glyph.types.js";

export const GLYPH_TAB_WIDTH = 6;
export const GLYPH_CHORD_GAP = 4;
/** A face disc's diameter in picture units: a glyph of height h draws a disc h across. */
export const GLYPH_ART_UNIT = 24.5;
/** The ink outline around a white picture, in picture units. */
export const GLYPH_ART_OUTLINE = 1.5;

/** The font a glyph draws in when the page does not say (the client's body font). */
export const GLYPH_FONT_FAMILY = '"Public Sans", sans-serif';

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
