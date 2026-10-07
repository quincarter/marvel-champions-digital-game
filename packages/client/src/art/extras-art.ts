/**
 * Extras-only pictures: everything in `art/extras/` belongs to no hero, scenario, campaign or story and is shown only
 * on the Extras ▸ Artwork shelf, always open. Nothing else reads this folder. The file name is the picture's title
 * (`psylocke-and-angel.png` → "Psylocke and Angel"); see `art/README.md`.
 *
 * The parsing is a pure function over a path → URL map, so it is tested without the glob.
 */
import type { Picture } from "./pictures.js";

/** Every picture in `art/extras/`, in a stable (path-sorted) order. Files in a subfolder are ignored. */
export function parseExtrasArt(files: Readonly<Record<string, string>>): readonly Picture[] {
  return Object.keys(files)
    .sort()
    .flatMap((path) => {
      const underArt = path.slice(path.lastIndexOf("art/extras/") + "art/extras/".length);
      if (underArt.includes("/")) return [];
      return [{ key: `extras-art:${underArt}`, url: files[path]! }];
    });
}

const files = import.meta.glob("../../../../art/extras/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const EXTRAS_ART: readonly Picture[] = parseExtrasArt(files);

const SMALL_WORDS = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "vs"]);

/** "psylocke-and-angel.png" → "Psylocke and Angel": title case, small words lowercase unless first. */
export function extrasArtTitle(key: string): string {
  const stem = (key.split(/[/:]/).at(-1) ?? key).replace(/\.[^.]+$/, "");
  return stem
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
