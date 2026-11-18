/**
 * Public card art for a mod card in Discord Rich Presence (issue #840). A custom card's picture lives in the local pack
 * store and reaches the board as a `blob:` URL, which Discord cannot fetch, so presence used to show the logo for every
 * mod game. The Mod Store serves each version's files under the catalog's `base` URL, so a pack installed from the store
 * has its pictures at `<base>cards/<lang>/<code>.webp`. Only an install whose bytes are the store's (its recorded zip
 * checksum matches the catalog's) uses that copy; any other install, a version the store does not list, or a withdrawn
 * pack has no public picture, and presence keeps the logo.
 *
 * Pure: the presence worker hands in the loaded packs (posted by the main thread) and the cached catalog's raw JSON.
 */
import type { PackLanguages } from "@mc/content";

/**
 * Local copies of `@mc/content`'s `packIdOfCardCode` and `resolvePackCardImage`: a value import of `@mc/content` would
 * bundle all of its card data into the presence worker. `discord-presence-pack-art.test.ts` checks the copies agree.
 */
export function packIdOfCode(code: string): string | undefined {
  if (!code.startsWith("x.")) return undefined;
  const end = code.indexOf(".", 2);
  return end > 2 ? code.slice(2, end) : undefined;
}

export function packImagePathOf(
  languages: PackLanguages | undefined,
  code: string,
  wanted: string,
  has: (path: string) => boolean,
): string | undefined {
  if (!languages) return undefined;
  for (const lang of wanted === languages.base ? [wanted] : [wanted, languages.base]) {
    const path = `cards/${lang}/${code}.webp`;
    if (languages.available.includes(lang) && has(path)) return path;
  }
  return undefined;
}

/** A loaded pack as presence needs it: posted from `art/pack-art.ts`'s table. */
export interface PresencePack {
  readonly id: string;
  readonly version: string;
  readonly languages: PackLanguages | undefined;
  readonly files: ReadonlySet<string>;
  /** The catalog zip checksum the install was verified against; absent on an install recorded before #840. */
  readonly zipSha256?: string | undefined;
}

/** A listed, not-withdrawn pack version in the catalog: its public base URL and its zip's checksum. */
export interface PresencePackBase {
  readonly base: string;
  readonly zipSha256: string;
}

/** The catalog's listed pack versions by `id@version`. */
export type PresencePackBases = ReadonlyMap<string, PresencePackBase>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads the cached store catalog (`mc-pack-catalog`) loosely: only what presence needs, and nothing on bad input. */
export function packBasesOf(catalogJson: string | null | undefined): PresencePackBases {
  const bases = new Map<string, PresencePackBase>();
  if (!catalogJson) return bases;
  let data: unknown;
  try {
    data = JSON.parse(catalogJson);
  } catch {
    return bases;
  }
  if (!isRecord(data) || !Array.isArray(data.packs)) return bases;
  for (const entry of data.packs) {
    if (!isRecord(entry) || typeof entry.id !== "string" || entry.withdrawn === true || !isRecord(entry.versions)) {
      continue;
    }
    for (const [version, info] of Object.entries(entry.versions)) {
      if (!isRecord(info)) continue;
      const { base, zipSha256 } = info;
      if (typeof base === "string" && /^https:\/\//i.test(base) && typeof zipSha256 === "string") {
        bases.set(`${entry.id}@${version}`, {
          base: base.endsWith("/") ? base : `${base}/`,
          zipSha256: zipSha256.toLowerCase(),
        });
      }
    }
  }
  return bases;
}

/**
 * The public URL of a custom card's picture: the first of `codes` (best first, as `packPictureCodes` gives them) that
 * the installed pack has in `lang` (English by default: presence is public, read by anyone) or its base language,
 * under the store's base URL for that pack version. Null when the pack is not loaded, the store does not list its
 * version, the install's bytes are not the store's, or it has no such picture.
 *
 * `trustUnrecorded`: whether an install with no recorded checksum (written before #840) counts as the store's. In a
 * release build every install came from the production catalog, verified by that checksum, so it does; a dev build may
 * have installed from a local catalog, so it does not.
 */
export function publicPackArtUrl(
  codes: readonly string[] | null | undefined,
  packs: ReadonlyMap<string, PresencePack>,
  bases: PresencePackBases,
  trustUnrecorded = false,
  lang = "en",
): string | null {
  for (const code of codes ?? []) {
    const id = packIdOfCode(code);
    const pack = id === undefined ? undefined : packs.get(id);
    if (!pack) continue;
    const listed = bases.get(`${pack.id}@${pack.version}`);
    if (!listed) continue;
    const fromStore =
      pack.zipSha256 === undefined ? trustUnrecorded : pack.zipSha256.toLowerCase() === listed.zipSha256;
    if (!fromStore) continue;
    const path = packImagePathOf(pack.languages, code, lang, (candidate) => pack.files.has(candidate));
    if (path !== undefined) return `${listed.base}${path.split("/").map(encodeURIComponent).join("/")}`;
  }
  return null;
}
