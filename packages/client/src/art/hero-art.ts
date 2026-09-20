/**
 * Hero artwork, found by convention in the repo's `art/` folder (see `art/README.md`):
 *
 *   art/heroes/<identityId>-<any-readable-slug>/hero.<ext>
 *
 * `<identityId>` is the hero identity card's own id (`01001a`, `51001a`), because nothing shorter is unique: two
 * heroes are named "Black Panther", two "Spider-Man", and a pack code covers several heroes (`core` has five). Only
 * the part before the first `-` is the lookup; the slug after it is for whoever is looking at the folder. Variants
 * work as they do for villains: `hero.jpg`, `hero-2.png`, one picked at random. A folder whose name starts with `_`
 * (`_pending/`) is a holding area and is never read.
 *
 * Pure over a path → URL map, like `scenario-art.ts`, so it is tested without the glob.
 */
import { pickPicture, type Picture } from "./pictures.js";

export interface HeroArtCatalog {
  /** By identity card id. */
  readonly heroes: ReadonlyMap<string, readonly Picture[]>;
  /** Files under `art/heroes/` that fit no slot, or sit at the wrong depth. */
  readonly unrecognized: readonly string[];
}

export function parseHeroArt(files: Readonly<Record<string, string>>): HeroArtCatalog {
  const heroes = new Map<string, Picture[]>();
  const unrecognized: string[] = [];
  for (const fullPath of Object.keys(files).sort()) {
    // Anchored on the whole prefix: a bare "art/" also ends "29001a-ironheart/".
    const underArt = fullPath.slice(fullPath.indexOf("art/heroes/") + "art/".length);
    const parts = underArt.split("/");
    if (parts[1]?.startsWith("_")) continue;
    const file = parts[parts.length - 1] ?? "";
    const stem = file.slice(0, file.lastIndexOf("."));
    if (parts[0] !== "heroes" || parts.length !== 3 || !(stem === "hero" || stem.startsWith("hero-"))) {
      unrecognized.push(underArt);
      continue;
    }
    const identityId = parts[1]!.split("-")[0]!;
    const entry = heroes.get(identityId) ?? [];
    entry.push({ key: `scene-art:${underArt}`, url: files[fullPath]! });
    heroes.set(identityId, entry);
  }
  return { heroes, unrecognized };
}

/** A hero's own artwork by identity card id, or null when there is none — every screen draws fine without it. */
export function heroArtFor(catalog: HeroArtCatalog, identityId: string, random: () => number = Math.random): Picture | null {
  return pickPicture(catalog.heroes.get(identityId) ?? [], null, random);
}

const files = import.meta.glob("../../../../art/heroes/*/*.{png,jpg,jpeg,webp,avif}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/** Everything in `art/heroes/`. */
export const HERO_ART: HeroArtCatalog = parseHeroArt(files);
