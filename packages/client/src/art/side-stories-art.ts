/**
 * Side-story comic pages, found by convention in the repo's `art/` folder (see `art/README.md`):
 *
 *   art/side-stories/<story-id>/<page>.<ext>   one page of a mini comic, read in file-name order
 *
 * `<story-id>` is the `id` of a side story in `content/side-stories.ts`, which says what the story is called and what
 * opens it; the folder name is the lookup. A folder whose name starts with `_` is a holding area and is never read.
 * Other files beside the pages (a `SOURCE.md`) are not pictures and are not globbed.
 *
 * The parsing is a pure function over a path → URL map, so it is tested without the glob.
 */
import type { Picture } from "./pictures.js";

/** Every side story's pages, by story id, each story's pages in path order. */
export function parseSideStoryArt(files: Readonly<Record<string, string>>): ReadonlyMap<string, readonly Picture[]> {
  const stories = new Map<string, Picture[]>();
  for (const fullPath of Object.keys(files).sort()) {
    const underArt = fullPath.slice(fullPath.lastIndexOf("art/side-stories/") + "art/side-stories/".length);
    const parts = underArt.split("/");
    if (parts.length !== 2 || parts[0]!.startsWith("_")) continue;
    const pages = stories.get(parts[0]!) ?? [];
    pages.push({ key: `side-story-art:${underArt}`, url: files[fullPath]! });
    stories.set(parts[0]!, pages);
  }
  return stories;
}

/** A page's picture: the file in the story's folder named for the page (`page-06` → `page-06.jpg`). */
export function sideStoryPageArt(
  art: ReadonlyMap<string, readonly Picture[]>,
  storyId: string,
  file: string,
): Picture | null {
  return (art.get(storyId) ?? []).find((picture) => picture.key.replace(/\.[^.]+$/, "").endsWith(`/${file}`)) ?? null;
}

const files = import.meta.glob("../../../../art/side-stories/*/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const SIDE_STORY_ART: ReadonlyMap<string, readonly Picture[]> = parseSideStoryArt(files);
