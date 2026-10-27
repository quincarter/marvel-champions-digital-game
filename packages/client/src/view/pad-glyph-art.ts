/**
 * The controller button pictures, one trimmed SVG per button and family in `ui/pad-glyphs/<family>/` (sources and
 * licences in `ui/pad-glyphs/README.md`, credited in `content/credits.ts`).
 *
 * Pure: which picture a standard-layout index wears on a family, its size, and its SVG recolored. The drawings use two
 * placeholder colors, `BODY` (the button) and `CUT` (the letter or mark cut into it); the colored face buttons (Xbox's
 * discs, PlayStation's symbols) keep their own colors. Pictures are named by position, not label: `face-south` is the
 * bottom face button, Xbox A, PlayStation ✕ and Switch B alike.
 * `ui/pad-glyph-textures.ts` turns them into textures.
 */

import type { PadFamily } from "./pad-family.js";

export type GlyphArt =
  | "face-south"
  | "face-east"
  | "face-west"
  | "face-north"
  | "lb"
  | "rb"
  | "lt"
  | "rt"
  | "view"
  | "menu"
  | "ls"
  | "rs"
  | "dpad-up"
  | "dpad-down"
  | "dpad-left"
  | "dpad-right"
  | "dpad"
  | "lstick"
  | "rstick";

/** A picture of one family: `xbox/face-south`. */
export type PadGlyphArtId = `${PadFamily}/${GlyphArt}`;

/** By standard-layout index (`view/gamepad.ts`): 0 bottom face … 15 D-pad right. */
const BY_INDEX: readonly GlyphArt[] = [
  "face-south",
  "face-east",
  "face-west",
  "face-north",
  "lb",
  "rb",
  "lt",
  "rt",
  "view",
  "menu",
  "ls",
  "rs",
  "dpad-up",
  "dpad-down",
  "dpad-left",
  "dpad-right",
];

const files = import.meta.glob("../ui/pad-glyphs/*/*.svg", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const SOURCES: ReadonlyMap<PadGlyphArtId, string> = new Map(
  Object.entries(files).map(([path, svg]) => [/pad-glyphs\/(.+)\.svg$/.exec(path)![1] as PadGlyphArtId, svg]),
);

/** Every picture there is. */
export const PAD_GLYPH_ARTS: readonly PadGlyphArtId[] = [...SOURCES.keys()];

/** A family's picture for one button, or null where the set has none (PlayStation's whole D-pad, extras). */
export function glyphArtFor(family: PadFamily, art: GlyphArt): PadGlyphArtId | null {
  const id: PadGlyphArtId = `${family}/${art}`;
  return SOURCES.has(id) ? id : null;
}

/** The picture the button at a standard-layout index wears on this family, or null. */
export function padGlyphArtOf(family: PadFamily, index: number): PadGlyphArtId | null {
  const art = BY_INDEX[index];
  return art === undefined ? null : glyphArtFor(family, art);
}

/** The raw SVG of a picture, placeholders and all. */
export function glyphArtSource(id: PadGlyphArtId): string {
  const svg = SOURCES.get(id);
  if (svg === undefined) throw new Error(`No controller glyph picture ${id}`);
  return svg;
}

/** A picture's size in its own units (an Xbox face disc is 24.5 across), from the SVG's viewBox. */
export function glyphArtSize(id: PadGlyphArtId): { readonly width: number; readonly height: number } {
  const box = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(glyphArtSource(id));
  if (!box) throw new Error(`Controller glyph ${id} has no viewBox`);
  return { width: Number(box[1]), height: Number(box[2]) };
}

/** The face disc's diameter in picture units: a glyph of height h draws a disc h across. */
export const GLYPH_ART_UNIT = 24.5;

/** The ink outline around a white picture, in picture units (about 1.5px on a 24px hint). */
export const GLYPH_ART_OUTLINE = 1.5;

/** A picture's size with its outline, in picture units: what its texture covers. */
export function glyphArtOutlinedSize(id: PadGlyphArtId): { readonly width: number; readonly height: number } {
  const size = glyphArtSize(id);
  const pad = isColoredGlyphArt(id) ? 0 : GLYPH_ART_OUTLINE * 2;
  return { width: size.width + pad, height: size.height + pad };
}

/**
 * The drawn size of a picture, outline included, for a glyph of height `h`: scaled so an outlined face disc is h
 * across, and nothing (a trigger, a stick with its arrows) runs past h.
 */
export function glyphArtDrawSize(id: PadGlyphArtId, h: number): { readonly width: number; readonly height: number } {
  const size = glyphArtOutlinedSize(id);
  const disc = isColoredGlyphArt(id) ? GLYPH_ART_UNIT : GLYPH_ART_UNIT + GLYPH_ART_OUTLINE * 2;
  const scale = h / Math.max(disc, size.height);
  return { width: size.width * scale, height: size.height * scale };
}

export type GlyphArtGround = "ink" | "paper";

export interface GlyphArtColors {
  readonly body: number;
  readonly cut: number;
}

/** The colored face buttons (Xbox's discs, PlayStation's symbols): drawn in their own colors, with no outline. */
export function isColoredGlyphArt(id: PadGlyphArtId): boolean {
  return id.startsWith("xbox/face-") || id.startsWith("playstation/face-");
}

/**
 * The colors of a picture: a white button with an ink mark on every ground, which `ui/pad-glyph-textures.ts` rings
 * with an ink outline so it reads on light and dark chrome alike (the owner, 2026-10-27). Xbox's colored face discs
 * keep an ink letter.
 */
export function glyphArtColors(
  _id: PadGlyphArtId,
  _ground: GlyphArtGround,
  palette: { readonly ink: number; readonly paper: number; readonly card: number },
): GlyphArtColors {
  return { body: palette.card, cut: palette.ink };
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** The SVG with its placeholders filled in. */
export function glyphArtSvg(id: PadGlyphArtId, colors: GlyphArtColors): string {
  return glyphArtSource(id)
    .replaceAll('"BODY"', `"${hex(colors.body)}"`)
    .replaceAll('"CUT"', `"${hex(colors.cut)}"`);
}
