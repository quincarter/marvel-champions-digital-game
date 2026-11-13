/**
 * Card pictures of installed custom packs (docs/custom-content-packs.md §7.4).
 *
 * A custom card (`x.<pack>.…`) has no scan under `assets/card-art/`: its picture is a file in the pack,
 * `cards/<lang>/<code>.webp`, held in the `PackStore` and served as a same-origin `blob:` URL (WebGL takes no
 * cross-origin texture). `art-source.ts`'s `artFor` asks `packArtFor` for it. The answer is synchronous, so the URL is
 * resolved ahead of the ask: the first ask for a picture returns null (the card draws its generated frame, the
 * designed fallback for a missing scan), starts the store read, and announces an art change when the URL is in, so the
 * screens redraw and ask again. The texture key is `art:pack:<id>@<version>/<path>`: versioned, so an updated pack
 * never draws the old version's texture, and a different language is a different path, hence a different key.
 *
 * `CardArt` calls `releasePackArt` when it evicts a texture: the blob URL is revoked through the store's own API and
 * forgotten here, and the next ask for that picture (the usual thing after an eviction) resolves it afresh.
 *
 * No store import: the store is handed in (`setPackArt`), so this module is Vitest-testable without IndexedDB, and
 * `card-art.ts` can import it without pulling the pack code into the board.
 */
import {
  houseRuleMayRebuild,
  packIdOfCardCode,
  parsePackCardImagePath,
  resolvePackCardImage,
  type PackLanguages,
  type PackManifest,
} from "@mc/content";
import { announceArtChange } from "../language-change.js";
import { setHouseRuleFaceSource, setPackArtResolver, type ArtSource } from "./art-source.js";

/** The part of the pack store this module reads: a file's `blob:` URL, and revoking it. */
export interface PackArtStore {
  objectUrl(id: string, path: string): Promise<string | undefined>;
  revoke(id: string, path?: string): void;
}

interface PackArtPack {
  readonly id: string;
  readonly version: string;
  readonly languages: PackLanguages | undefined;
  readonly files: ReadonlySet<string>;
  /** The manifest's full-bleed pictures, by role then card code. */
  readonly pictures: PackManifest["pictures"];
  /** A `house-rule` pack's rule: its pictures are rebuilt official faces (docs/custom-content-packs.md §11.11). */
  readonly houseRule: PackManifest["houseRule"];
}

let packs: ReadonlyMap<string, PackArtPack> = new Map();
let store: PackArtStore | undefined;
/** Resolved blob URLs by texture key. */
const urls = new Map<string, string>();
/** Which pack file a texture key names, so an eviction can revoke exactly that file. */
const fileOfKey = new Map<string, { readonly id: string; readonly path: string }>();
/** Keys whose URL is being read from the store. */
const resolving = new Set<string>();
let announcedSignature = "";
let announceTimer: ReturnType<typeof setTimeout> | undefined;

/** The texture key of a pack picture. */
export function packArtKey(id: string, version: string, path: string): string {
  return `art:pack:${id}@${version}/${path}`;
}

/** Tells every screen showing art to ask again, once for a run of arrivals. */
function announceSoon(): void {
  if (announceTimer !== undefined) return;
  announceTimer = setTimeout(() => {
    announceTimer = undefined;
    announceArtChange();
  }, 80);
}

/**
 * Replaces the set of packs whose pictures can be shown: the loaded packs' manifests and the store holding their
 * files. Pictures of a pack that is gone or at another version are forgotten (the store has revoked their URLs on
 * its own install and remove). Announces an art change when a pack is there to show, so a card drawn before the packs
 * finished loading asks again.
 */
export function setPackArt(
  manifests: readonly PackManifest[],
  from: PackArtStore | undefined,
  unloaded: readonly PackManifest[] = [],
): void {
  store = from;
  const previousSize = packs.size;
  packs = new Map([
    // An installed pack that is not loaded (its game is too old, a requirement is missing) still shows its own cover in
    // the Mod Store, offline: only that one file, never a card picture.
    ...unloaded.flatMap((manifest): [string, PackArtPack][] =>
      typeof manifest.cover === "string" && manifest.files.some((file) => file.path === manifest.cover)
        ? [
            [
              manifest.id,
              {
                id: manifest.id,
                version: manifest.version,
                languages: undefined,
                files: new Set([manifest.cover]),
                pictures: undefined,
                houseRule: undefined,
              },
            ],
          ]
        : [],
    ),
    ...manifests.map((manifest): [string, PackArtPack] => [
      manifest.id,
      {
        id: manifest.id,
        version: manifest.version,
        languages: manifest.languages,
        files: new Set(manifest.files.map((file) => file.path)),
        pictures: manifest.pictures,
        houseRule: manifest.houseRule,
      },
    ]),
  ]);
  for (const key of [...fileOfKey.keys()]) {
    const info = fileOfKey.get(key)!;
    const pack = packs.get(info.id);
    if (pack && key === packArtKey(pack.id, pack.version, info.path)) continue;
    urls.delete(key);
    fileOfKey.delete(key);
    resolving.delete(key);
  }
  // Every picture's URL is read ahead (a blob URL is a reference, not a decode), so a screen that builds its view model
  // once, such as the table, finds it on its first ask. Only a change in what is loaded is announced.
  for (const pack of packs.values()) {
    for (const path of pack.files) if (parsePackCardImagePath(path)) ensure(pack, path);
    for (const byCode of Object.values(pack.pictures ?? {}))
      for (const path of Object.values(byCode)) ensure(pack, path);
  }
  const signature = [...packs.values()].map((pack) => `${pack.id}@${pack.version}`).join(",");
  if (signature !== announcedSignature) {
    announcedSignature = signature;
    if (packs.size > 0 || previousSize > 0) announceSoon();
  }
}

/**
 * The picture of custom card `code` in language `lang` (the player's, falling back to the pack's base language), or
 * null when there is none yet: the pack is not loaded, has no picture for the card, or its URL is still being read
 * (an art change is announced when it lands).
 */
export function packArtFor(code: string, lang: string): ArtSource | null {
  const id = packIdOfCardCode(code);
  const pack = id === undefined ? undefined : packs.get(id);
  if (!pack) return null;
  const path = resolvePackCardImage(pack.languages, code, lang, (candidate) => pack.files.has(candidate));
  if (path === undefined) return null;
  return sourceOf(pack, path);
}

/**
 * A house-rule pack's rebuilt face of official face code `code` (`cards/<lang>/<code>.webp`), in `lang` or the pack's
 * base language, or null when the pack is not a loaded house rule, has no such face, or its URL is still being read.
 */
export function houseRuleFaceFor(packId: string, code: string, lang: string, version?: string): ArtSource | null {
  const pack = packs.get(packId);
  if (!pack?.houseRule) return null;
  // Only a face the rule owns (its trait additions, or the Balanced cards) and, for a game carrying the rule, the
  // version the game was set up with: any other picture or version keeps the printed face.
  if (version !== undefined && pack.version !== version) return null;
  if (!houseRuleMayRebuild(pack.houseRule, code)) return null;
  const path = resolvePackCardImage(pack.languages, code, lang, (candidate) => pack.files.has(candidate));
  return path === undefined ? null : sourceOf(pack, path);
}

/** The loaded house-rule pack that enables `mode`, by id. */
export function packEnablingMode(mode: string): string | undefined {
  for (const pack of packs.values()) if (pack.houseRule?.enablesMode === mode) return pack.id;
  return undefined;
}

/**
 * The full-bleed picture a pack gives `code` in `role` (`pack.json`'s `pictures`: `hero` for the hero select), or null
 * when it has none or its URL is still being read. Same lifetime and key scheme as `packArtFor`.
 */
export function packPictureFor(role: string, code: string): ArtSource | null {
  const id = packIdOfCardCode(code);
  const pack = id === undefined ? undefined : packs.get(id);
  const path = pack?.pictures?.[role]?.[code];
  return pack && path !== undefined && pack.files.has(path) ? sourceOf(pack, path) : null;
}

/**
 * A file of pack `id` as a picture (a pack campaign's cover, `PackCampaign.art.cover`), or null when the pack is not
 * loaded, does not list the file, or its URL is still being read (an art change is announced when it lands).
 */
export function packFileArt(id: string, path: string): ArtSource | null {
  const pack = packs.get(id);
  return pack?.files.has(path) ? sourceOf(pack, path) : null;
}

function sourceOf(pack: PackArtPack, path: string): ArtSource | null {
  const key = packArtKey(pack.id, pack.version, path);
  const url = urls.get(key);
  if (url !== undefined) return { key, url };
  ensure(pack, path);
  return null;
}

/** Starts reading one file's blob URL from the store, once; an art change is announced when it lands. */
function ensure(pack: PackArtPack, path: string): void {
  const key = packArtKey(pack.id, pack.version, path);
  if (store && !urls.has(key) && !resolving.has(key)) {
    resolving.add(key);
    fileOfKey.set(key, { id: pack.id, path });
    store
      .objectUrl(pack.id, path)
      .then((resolved) => {
        // A pack replaced or removed while the read was out: this URL is stale.
        if (!resolving.has(key)) return;
        if (resolved !== undefined) {
          urls.set(key, resolved);
          announceSoon();
        }
      })
      .catch(() => undefined)
      .finally(() => resolving.delete(key));
  }
}

/** Whether `key` is a pack picture's texture key. */
export const isPackArtKey = (key: string): boolean => key.startsWith("art:pack:");

/**
 * `CardArt` evicted this texture: revoke the blob URL it was loaded from and forget it. The next ask for the picture
 * reads it from the store again. Any other key is none of this module's business.
 */
export function releasePackArt(key: string): void {
  const info = fileOfKey.get(key);
  if (!info) return;
  store?.revoke(info.id, info.path);
  urls.delete(key);
  fileOfKey.delete(key);
}

/** Test seam: forgets every pack and URL. */
export function resetPackArt(): void {
  packs = new Map();
  store = undefined;
  urls.clear();
  fileOfKey.clear();
  resolving.clear();
  if (announceTimer !== undefined) clearTimeout(announceTimer);
  announceTimer = undefined;
  announcedSignature = "";
}

setPackArtResolver(packArtFor);
setHouseRuleFaceSource({ face: houseRuleFaceFor, packEnabling: packEnablingMode });
