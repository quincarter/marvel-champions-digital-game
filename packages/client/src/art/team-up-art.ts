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
import { DEFAULT_BADGE_FOCUS, type BadgeFocus } from "../view/badge-crop.js";
import type { Picture } from "./pictures.js";

export { DEFAULT_BADGE_FOCUS, type BadgeFocus };

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
  const slug = teamUpSlug(names);
  const art = catalog.pairs.get(slug) ?? null;
  // A pair whose crop is cut from the full picture shows that in its circles in place of the closeup.
  if (art?.splash && BADGE_FOCUS[slug]?.source === "splash") return { splash: art.splash, badge: art.splash };
  return art;
}

/**
 * The crop spec per pair, by slug (see `view/badge-crop.ts`): where the circle's square is centered, how far it is
 * zoomed in, and which picture it is cut from. A pair without an entry shows its whole closeup, centered. Values are
 * chosen by eye against the circle in the popup and the 64 and 48 px rings, so that both characters' heads sit inside
 * the circle with a margin; the commented reason says what the default got wrong.
 */
export const BADGE_FOCUS: Readonly<Record<string, BadgeFocus>> = {
  // The closeup's corners hold both heads. The full picture, zoomed out to a 760 px circle, fits Iron Man's helmet
  // and War Machine's head; War Machine's gun barrel still leaves the circle on the left.
  "iron-man-war-machine": { source: "splash", x: 0.444, y: 0.374, zoom: 1.335 },
  // Wasp's helmet sits in the top-right corner: the square slides right so the circle holds her head and Ant-Man's.
  "ant-man-wasp": { x: 0.57, y: 0.5, zoom: 1 },
  // The closeup cuts Phoenix's hair and Cyclops's hair at its edges; the taller full picture holds both faces. Phoenix's
  // flames are cut by the top of the picture itself, so they still meet the circle's top.
  "cyclops-phoenix": { source: "splash", x: 0.485, y: 0.22, zoom: 1.224 },
  // Slid so Gamora's hair and Quicksilver's hair clear the circle's near edge, with room to spare on the far side.
  "gamora-nebula": { x: 0.42, y: 0.5, zoom: 1 },
  "groot-rocket-raccoon": { x: 0.48, y: 0.5, zoom: 1 },
  "quicksilver-scarlet-witch": { x: 0.47, y: 0.5, zoom: 1 },
};

/** The full picture standing in for a missing closeup is portrait, so its square looks at the faces (upper middle). */
export const SPLASH_FALLBACK_FOCUS: BadgeFocus = { x: 0.5, y: 0.4, zoom: 1.3 };

/** The crop focus for a picture, by its catalog key (`team-up-art:teamups/<slug>/<slot>.<ext>`). */
export function badgeFocusFor(pictureKey: string): BadgeFocus {
  const [folder, file] = pictureKey.replace(/^team-up-art:teamups\//, "").split("/");
  const spec = folder ? BADGE_FOCUS[folder] : undefined;
  // A spec is cut from the picture it names; any other picture of the pair is a stand-in and gets the fallback.
  if (file?.startsWith("splash.")) return spec?.source === "splash" ? spec : SPLASH_FALLBACK_FOCUS;
  return spec?.source === "splash" ? DEFAULT_BADGE_FOCUS : (spec ?? DEFAULT_BADGE_FOCUS);
}

const files = import.meta.glob("../../../../art/teamups/*/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Everything in `art/teamups/`. */
export const TEAM_UP_ART: TeamUpArtCatalog = parseTeamUpArt(files);
