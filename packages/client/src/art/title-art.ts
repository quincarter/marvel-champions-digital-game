/**
 * Title-screen art: a random picture from `art/title/` each time the Title is
 * shown. Drop another file in that folder to add one — see `art/README.md` for
 * the whole folder convention, and `pictures.ts` for what pictures share.
 */
import { coverFit, pickPicture, type Picture } from "./pictures.js";

export { coverFit };
export type TitleArt = Picture;

const files = import.meta.glob("../../../../art/title/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Every picture in `art/title/`, in a stable (path-sorted) order. */
export const TITLE_ART: readonly TitleArt[] = Object.keys(files)
  .sort()
  .map((path) => ({ key: `title-art:${path.slice(path.lastIndexOf("/") + 1)}`, url: files[path]! }));

/** One title picture at random, never the one shown last time when there is a choice. */
export const pickTitleArt = pickPicture;

/**
 * Every title picture's size in pixels, by file name. Sizes are only known after a picture loads, and the choice is
 * made before, so they are recorded here (`title-art.test.ts` fails when a file in `art/title/` has no entry, or an
 * entry has no file). A new picture: add its `width, height` here.
 */
export const TITLE_ART_SIZES: Readonly<Record<string, { readonly width: number; readonly height: number }>> = {
  "back-to-basics-back-cover.jpg": { width: 3975, height: 3056 },
  "box-core-set.jpeg": { width: 418, height: 478 },
  "hercules.jpeg": { width: 815, height: 1295 },
  "mutant-genesis-x-men.webp": { width: 875, height: 1350 },
  "rise-of-apocalypse.jpeg": { width: 1080, height: 1350 },
  "spider-verse-team.webp": { width: 1027, height: 1609 },
  "wallpaper-1.jpg": { width: 2560, height: 1600 },
  "wallpaper-2.jpg": { width: 8000, height: 4456 },
  "wallpaper-4-wide.webp": { width: 1800, height: 790 },
  "wallpaper-4.webp": { width: 1999, height: 1499 },
  "wallpaper-5.jpg": { width: 1500, height: 1003 },
  "wallpaper-portrait.jpg": { width: 600, height: 927 },
};

/** The most a title picture may be enlarged, in device pixels per picture pixel, before it looks soft or blocky. */
export const TITLE_ART_MAX_UPSCALE = 1.5;

/** A picture's size by its texture key (`title-art:<file name>`), or null for one not in the table. */
export function titleArtSizeOf(picture: Picture): { readonly width: number; readonly height: number } | null {
  return TITLE_ART_SIZES[picture.key.slice(picture.key.indexOf(":") + 1)] ?? null;
}

/**
 * How far `size` is enlarged to cover `panel` (game units) drawn at `density` device pixels per unit: `coverFit`'s scale
 * (which crops the overflowing side, so a tall picture in a wide panel is judged by its width) times the density.
 */
export function upscaleOf(
  size: { readonly width: number; readonly height: number },
  panel: { readonly width: number; readonly height: number },
  density: number,
): number {
  return coverFit(size, panel).scale * density;
}

/**
 * One title picture for a panel, at random: only those that cover it enlarged by no more than `maxUpscale` (issue #760,
 * low-resolution pictures looking pixelated on a high-density screen). When none do, the best-resolution picture (the
 * least enlarged). Never `avoidKey` (the one shown last time) while there is another choice. A picture of unknown size
 * counts as good enough; no panel (a phone draws no picture) is no filter.
 */
export function pickTitleArtFor<T extends Picture>(
  pool: readonly T[],
  sizeOf: (picture: T) => { readonly width: number; readonly height: number } | null,
  panel: { readonly width: number; readonly height: number } | null,
  density: number,
  avoidKey: string | null = null,
  random: () => number = Math.random,
  maxUpscale: number = TITLE_ART_MAX_UPSCALE,
): T | null {
  if (!panel) return pickPicture(pool, avoidKey, random) as T | null;
  const upscales = new Map<T, number>();
  for (const picture of pool) {
    const size = sizeOf(picture);
    upscales.set(picture, size ? upscaleOf(size, panel, density) : 0);
  }
  const choices = pool.length > 1 ? pool.filter((picture) => picture.key !== avoidKey) : pool;
  const good = choices.filter((picture) => upscales.get(picture)! <= maxUpscale);
  if (good.length > 0) return pickPicture(good, null, random) as T | null;
  let best: T | null = null;
  for (const picture of choices) if (best === null || upscales.get(picture)! < upscales.get(best)!) best = picture;
  return best;
}
