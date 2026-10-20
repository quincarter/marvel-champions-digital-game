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
 * An optional `focus.json` beside the pictures, `{ "x": 0.38, "y": 0.3 }`, says where the subject is (0 left/top to
 * 1 right/bottom) so a tall or small crop centers on it instead of on the middle of the picture. Either axis may be
 * left out. It applies to every picture in the folder and rides on each `Picture.focus`.
 *
 * Pure over a path → URL map, like `scenario-art.ts`, so it is tested without the glob.
 */
import { pickPicture, type Picture, type PictureFocus } from "./pictures.js";

export interface HeroArtCatalog {
  /** By identity card id. */
  readonly heroes: ReadonlyMap<string, readonly Picture[]>;
  /** Files under `art/heroes/` that fit no slot, or sit at the wrong depth. */
  readonly unrecognized: readonly string[];
}

/** A `focus.json`'s content as a focus, or null when it names no usable axis. Values outside 0 to 1 are clamped. */
export function parseFocus(raw: unknown): PictureFocus | null {
  if (typeof raw !== "object" || raw === null) return null;
  const axis = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined;
  const x = axis((raw as { x?: unknown }).x);
  const y = axis((raw as { y?: unknown }).y);
  if (x === undefined && y === undefined) return null;
  return { ...(x === undefined ? {} : { x }), ...(y === undefined ? {} : { y }) };
}

export function parseHeroArt(
  files: Readonly<Record<string, string>>,
  focusFiles: Readonly<Record<string, unknown>> = {},
): HeroArtCatalog {
  const heroes = new Map<string, Picture[]>();
  const unrecognized: string[] = [];
  const focusOf = new Map<string, PictureFocus>();
  for (const [fullPath, raw] of Object.entries(focusFiles)) {
    const folder = fullPath.slice(fullPath.indexOf("art/heroes/") + "art/heroes/".length).split("/")[0] ?? "";
    const focus = parseFocus(raw);
    if (focus && !folder.startsWith("_")) focusOf.set(folder.split("-")[0]!, focus);
  }
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
    const focus = focusOf.get(identityId);
    entry.push({ key: `scene-art:${underArt}`, url: files[fullPath]!, ...(focus ? { focus } : {}) });
    heroes.set(identityId, entry);
  }
  return { heroes, unrecognized };
}

/** A hero's own artwork by identity card id, or null when there is none — every screen draws fine without it. */
export function heroArtFor(
  catalog: HeroArtCatalog,
  identityId: string,
  random: () => number = Math.random,
): Picture | null {
  return pickPicture(catalog.heroes.get(identityId) ?? [], null, random);
}

/**
 * `heroArtFor`, but a hero printed as more than one identity card (Ironheart's three versions) shares the picture
 * filed under any of them: same name, same set.
 */
export function heroArtForIdentity(
  catalog: HeroArtCatalog,
  identityId: string,
  cards: readonly { readonly id: string; readonly type: string; readonly name: string; readonly setCode?: string }[],
  random: () => number = Math.random,
): Picture | null {
  const identity = cards.find((card) => card.id === identityId);
  const sameHero = identity
    ? cards
        .filter(
          (card) => card.type === "hero_identity" && card.name === identity.name && card.setCode === identity.setCode,
        )
        .map((card) => card.id)
    : [];
  return (
    [identityId, ...sameHero].map((id) => heroArtFor(catalog, id, random)).find((picture) => picture !== null) ?? null
  );
}

const files = import.meta.glob("../../../../art/heroes/*/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const focusFiles = import.meta.glob("../../../../art/heroes/*/focus.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

/** Everything in `art/heroes/`. */
export const HERO_ART: HeroArtCatalog = parseHeroArt(files, focusFiles);
