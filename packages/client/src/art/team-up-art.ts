/**
 * Team-Up pictures, found by convention in the repo's `art/` folder (see `art/README.md`):
 *
 *   art/teamups/<pair-slug>/splash.<ext>   the full picture, shown once when the Team-Up first becomes active
 *   art/teamups/<pair-slug>/badge.<ext>    the closeup, shown in a circle on the Board while it is active
 *
 * `<pair-slug>` is the two names a `teamUp` keyword carries, each lowercased and reduced to letters and digits,
 * sorted and joined with `-` (`["Rogue", "Gambit"]` and `["Gambit", "Rogue"]` are both `gambit-rogue`), so there is no
 * table mapping pairs to files: the folder name *is* the lookup. A pair with neither picture simply has no splash and
 * no badge; there is no placeholder. A folder whose name starts with `_` is a holding area and is never read.
 *
 * The parsing and the lookup are pure functions over a path → URL map, so they are tested without the glob.
 */
import type { Picture } from "./pictures.js";

const SLOTS = ["splash", "badge"] as const;
export type TeamUpArtSlot = (typeof SLOTS)[number];

export interface TeamUpArt {
  readonly splash: Picture | null;
  readonly badge: Picture | null;
}

export interface TeamUpArtCatalog {
  readonly pairs: ReadonlyMap<string, TeamUpArt>;
  /** Files under `art/teamups/` whose name fits no slot, or that sit outside a pair folder: a typo, by any other name. */
  readonly unrecognized: readonly string[];
}

const slugOfName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** The folder name for a pair of names: lowercased, sorted, `gambit-rogue`. Order-independent. */
export function teamUpSlug(names: readonly [string, string]): string {
  return names.map(slugOfName).sort().join("-");
}

/** Builds the catalog from a path → URL map. Only the part of each path from `art/` on is read. */
export function parseTeamUpArt(files: Readonly<Record<string, string>>): TeamUpArtCatalog {
  const found = new Map<string, { splash: Picture | null; badge: Picture | null }>();
  const unrecognized: string[] = [];
  for (const fullPath of Object.keys(files).sort()) {
    const underArt = fullPath.slice(fullPath.lastIndexOf("art/") + "art/".length);
    const parts = underArt.split("/");
    if (parts[0] !== "teamups" || parts.length !== 3) {
      unrecognized.push(underArt);
      continue;
    }
    const folder = parts[1]!;
    if (folder.startsWith("_")) continue;
    const file = parts[2]!;
    const stem = file.slice(0, file.lastIndexOf("."));
    const slot = SLOTS.find((candidate) => candidate === stem);
    if (!slot) {
      unrecognized.push(underArt);
      continue;
    }
    const entry = found.get(folder) ?? { splash: null, badge: null };
    entry[slot] = { key: `team-up-art:${underArt}`, url: files[fullPath]! };
    found.set(folder, entry);
  }
  return { pairs: found, unrecognized };
}

/** The pictures for a pair, or null when it has none at all. A pair with only one of the two gets just that one. */
export function teamUpArtFor(catalog: TeamUpArtCatalog, names: readonly [string, string]): TeamUpArt | null {
  return catalog.pairs.get(teamUpSlug(names)) ?? null;
}

/**
 * Where the square crop of a badge is centered, and how far it is zoomed in. The owner supplies each badge already
 * cropped to the two faces, so the default is the whole picture, centered, as the largest square that fits.
 * `x` and `y` are the crop's center as a fraction of the picture (0 left/top, 1 right/bottom); `zoom` 1 is the whole
 * short side. A pair whose faces still fall outside the centered square gets an entry here, by slug.
 */
export interface BadgeFocus {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export const DEFAULT_BADGE_FOCUS: BadgeFocus = { x: 0.5, y: 0.5, zoom: 1 };
/** The full picture standing in for a missing closeup is portrait, so its square looks at the faces (upper middle). */
export const SPLASH_FALLBACK_FOCUS: BadgeFocus = { x: 0.5, y: 0.4, zoom: 1.3 };
export const BADGE_FOCUS: Readonly<Record<string, BadgeFocus>> = {};

/** The crop focus for a picture, by its catalog key (`team-up-art:teamups/<slug>/<slot>.<ext>`). */
export function badgeFocusFor(pictureKey: string): BadgeFocus {
  const [folder, file] = pictureKey.replace(/^team-up-art:teamups\//, "").split("/");
  if (file?.startsWith("splash.")) return SPLASH_FALLBACK_FOCUS;
  return (folder ? BADGE_FOCUS[folder] : undefined) ?? DEFAULT_BADGE_FOCUS;
}

const files = import.meta.glob("../../../../art/teamups/*/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Everything in `art/teamups/`. */
export const TEAM_UP_ART: TeamUpArtCatalog = parseTeamUpArt(files);
