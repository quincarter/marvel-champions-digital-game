/**
 * Title-screen art: a random picture from `art/title/` each time the Title is
 * shown. Drop another file in that folder to add one — see `art/README.md` for
 * the whole folder convention, and `pictures.ts` for what pictures share.
 */
import { pickPicture, type Picture } from "./pictures.js";

export { coverFit } from "./pictures.js";
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
