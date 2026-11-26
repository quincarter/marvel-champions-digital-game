/**
 * Smaller copies of full-bleed pictures. A roster tile (Scenario select, Take your seats) is at most 300 px wide and
 * 440 px tall and cover-crops its picture, so decoding a 640 KB, 4000 px hero picture for it wastes a phone's
 * bandwidth and memory; a title picture drawn in the guide chooser's panel is not 4000 px either. The build makes a
 * smaller WebP of each (`vite-roster-art.ts`, asked for with an import query), and the catalogs carry it as
 * `Picture.tileUrl` / `TitleArt.displayUrl`. This module is the pure part: the sizes, which pictures get a copy, and
 * how an import id is read.
 */

/** The largest tile the rosters draw, in CSS px (`#cardMetrics` in `scenes/scenario-select.ts` and `scenes/seats.ts`). */
export const ROSTER_TILE = { width: 300, height: 440 } as const;
/** Pixel density a roster copy covers: a tile on a 2x screen is sharp, a 3x phone's is slightly soft. */
export const ROSTER_DENSITY = 2;
/** The WebP quality of a roster copy. */
export const ROSTER_QUALITY = 72;
/** The import query that asks for the roster copy of a picture (`import url from "art/…/hero.jpg?roster"`). */
export const ROSTER_QUERY = "roster";
/** The longest side of a display copy (a title picture drawn in a panel), in px. */
export const DISPLAY_LONG_EDGE = 2048;
/** The import query that asks for the display copy of a title picture. */
export const DISPLAY_QUERY = "display";

/** Which copy an import asks for: a roster tile's, or a panel-size one of a title picture. */
export type CopyKind = "roster" | "display";

/**
 * The size to shrink a `width` x `height` picture to so a cover-crop into a roster tile is still at
 * `ROSTER_DENSITY` times the tile: the larger of the two scales that fill the tile, never past the picture's own
 * size. The aspect ratio is kept; the tile does the cropping.
 */
export function rosterSizeFor(width: number, height: number): { readonly width: number; readonly height: number } {
  if (width <= 0 || height <= 0) return { width, height };
  const scale = Math.min(
    1,
    Math.max((ROSTER_TILE.width * ROSTER_DENSITY) / width, (ROSTER_TILE.height * ROSTER_DENSITY) / height),
  );
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The size of the `kind` copy of a `width` x `height` picture. */
export function copySizeFor(
  kind: CopyKind,
  width: number,
  height: number,
): { readonly width: number; readonly height: number } {
  if (kind === "roster") return rosterSizeFor(width, height);
  if (width <= 0 || height <= 0) return { width, height };
  const scale = Math.min(1, DISPLAY_LONG_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** True for a path under `art/` that the `kind` copy is made for: the hero and villain pictures the tiles draw, or a title picture. */
export function hasCopy(kind: CopyKind, pathUnderArt: string): boolean {
  const parts = pathUnderArt.split("/");
  const file = parts[parts.length - 1] ?? "";
  const stem = file.slice(0, file.lastIndexOf("."));
  if (kind === "display") return parts[0] === "title" && parts.length === 2;
  if (parts[0] === "heroes" && parts.length === 3) return stem === "hero" || stem.startsWith("hero-");
  if (parts[0] === "scenarios" && parts.length === 3) return stem === "villain" || /^villain-\d+$/.test(stem);
  return false;
}

/**
 * Maps the module id Vite hands the plugin (`/abs/art/heroes/x/hero.jpg?roster`) to the copy asked for, the file and
 * its path under `art/`; null when the id is not such a request for a picture that has that copy.
 */
export function copySourceOf(
  id: string,
): { readonly kind: CopyKind; readonly file: string; readonly underArt: string } | null {
  const q = id.indexOf("?");
  if (q < 0) return null;
  const params = new URLSearchParams(id.slice(q + 1));
  const kind: CopyKind | null = params.has(ROSTER_QUERY) ? "roster" : params.has(DISPLAY_QUERY) ? "display" : null;
  if (!kind) return null;
  const file = id.slice(0, q).replaceAll("\\", "/");
  const at = file.lastIndexOf("/art/");
  if (at < 0) return null;
  const underArt = file.slice(at + "/art/".length);
  return hasCopy(kind, underArt) ? { kind, file, underArt } : null;
}
