/**
 * Title-screen art: a random picture from the repo's `art/` folder each time
 * the Title is shown.
 *
 * The folder is globbed at build time, so dropping another `.png`/`.jpg`/
 * `.jpeg`/`.webp` into `art/` is all it takes to add one — no list to edit.
 * Vite emits each file as a hashed asset in a production build and serves it
 * through `/@fs/` in dev (the workspace root is inside the dev server's allow
 * list). Same origin either way, which WebGL needs to accept it as a texture.
 *
 * The pick itself is a pure function over the list so it can be tested
 * without the glob: it never repeats the picture just shown when there is
 * more than one to choose from.
 */

export interface TitleArt {
  /** Stable Phaser texture key, derived from the file name. */
  readonly key: string;
  readonly url: string;
}

const files = import.meta.glob("../../../../art/*.{png,jpg,jpeg,webp}", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;

/** Every picture in `art/`, in a stable (path-sorted) order. */
export const TITLE_ART: readonly TitleArt[] = Object.keys(files)
  .sort()
  .map((path) => ({ key: `title-art:${path.slice(path.lastIndexOf("/") + 1)}`, url: files[path]! }));

/**
 * One picture at random — never `avoidKey` (the one shown last time) unless it's the only one.
 * `random` is `Math.random` by default and injectable for tests.
 */
export function pickTitleArt(pool: readonly TitleArt[], avoidKey: string | null = null, random: () => number = Math.random): TitleArt | null {
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 ? pool.filter((art) => art.key !== avoidKey) : pool;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index] ?? null;
}

/**
 * Where a picture of `image` (natural size) goes to cover `panel` edge to edge, cropping whichever
 * dimension overflows: the scale to draw it at, and the crop rectangle in the picture's own pixels.
 */
export function coverFit(
  image: { readonly width: number; readonly height: number },
  panel: { readonly width: number; readonly height: number },
): { readonly scale: number; readonly cropX: number; readonly cropY: number; readonly cropWidth: number; readonly cropHeight: number } {
  const scale = Math.max(panel.width / image.width, panel.height / image.height);
  const cropWidth = Math.min(image.width, panel.width / scale);
  const cropHeight = Math.min(image.height, panel.height / scale);
  return { scale, cropX: (image.width - cropWidth) / 2, cropY: (image.height - cropHeight) / 2, cropWidth, cropHeight };
}
