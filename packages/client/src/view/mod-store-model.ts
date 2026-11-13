/**
 * The Mod Store screen's logic (docs/custom-content-packs.md §11.6), kept out of the scene: which packs a tab shows, what
 * a tile says, which buttons a pack's state offers, how far an install has got and what a failure means in plain
 * English. Everything here is pure; the scene (`scenes/mod-store.ts`) only draws it.
 *
 * Nothing here decides whether a pack can be installed: `packs/pack-state.ts` does, and this reads its answer.
 */
import type { AnyCard, PackIndex, PackIndexEntry, PackKind } from "@mc/content";
import { defaultFaceFor, type CardFace } from "../art/art-source.js";
import type { ParsedPackPreview } from "../packs/pack-preview.js";
import { packStateOf, formatBytes, type PackState } from "../packs/pack-state.js";
import type { InstalledPack } from "../packs/pack-store.js";
import type { InstallProgress } from "../packs/install-pack.js";
import type { PackInstallErrorCode } from "../packs/unpack-pack.js";
import type { ExtrasGrid } from "./extras-model.js";
import { ruleFaceOf } from "./pack-gallery-model.js";

export type ModStoreTab = "all" | "heroes" | "scenarios" | "house-rules" | "installed";

/** The browse tabs. House rules have their own (the owner, 2026-11-13; docs/custom-content-packs.md §11.11). */
export const MOD_STORE_TABS: readonly { readonly id: ModStoreTab; readonly label: string }[] = [
  { id: "all", label: "All" },
  { id: "heroes", label: "Heroes" },
  { id: "scenarios", label: "Scenarios" },
  { id: "house-rules", label: "House rules" },
  { id: "installed", label: "Installed" },
];

/** The narrowest tab that still fits its label ("SCENARIOS", "INSTALLED") on one line. */
const MIN_TAB_WIDTH = 84;

/** The tabs laid out in rows for a row `width` wide: one row, or two (3 + 2) where five tabs would cut their labels. */
export function modStoreTabRowsOf(width: number): readonly (typeof MOD_STORE_TABS)[number][][] {
  if (width / MOD_STORE_TABS.length >= MIN_TAB_WIDTH) return [[...MOD_STORE_TABS]];
  const split = Math.ceil(MOD_STORE_TABS.length / 2);
  return [MOD_STORE_TABS.slice(0, split), MOD_STORE_TABS.slice(split)];
}

export interface ModStoreContext {
  readonly appVersion: string;
  readonly supportedDslFeatures: readonly string[];
  readonly installed: ReadonlyMap<string, InstalledPack>;
}

export const KIND_LABELS: Readonly<Record<PackKind, string>> = {
  hero: "Hero",
  scenario: "Scenario",
  modular: "Modular set",
  campaign: "Campaign",
  art: "Art",
  "house-rule": "House rule",
};

/** The chip's words. Never color alone: every state has its own label. */
export const STATE_LABELS: Readonly<Record<PackState, string>> = {
  install: "Install",
  installed: "Installed",
  update: "Update",
  "needs-app-update": "Needs app update",
  withdrawn: "Withdrawn",
};

export const OFFLINE_NOTICE = "You are offline. Showing the last copy of the store.";
export const LOADING_TEXT = "Loading the store...";
export const LOAD_FAILED_TEXT = "The store could not be reached, and there is no saved copy yet.";

export function emptyTextOf(tab: ModStoreTab): string {
  if (tab === "installed") return "No custom packs are installed yet.";
  if (tab === "heroes") return "The store has no hero packs yet.";
  if (tab === "scenarios") return "The store has no scenario packs yet.";
  if (tab === "house-rules") return "The store has no house rules yet.";
  return "The store has no packs yet. Check back soon.";
}

export interface ModStoreTile {
  readonly id: string;
  readonly name: string;
  readonly creator: string;
  readonly kind: PackKind;
  readonly kindLabel: string;
  readonly summary: string;
  readonly state: PackState;
  readonly stateLabel: string;
  /** The version a tap on the primary button would install, or the installed one for a pack the store no longer lists. */
  readonly version: string;
  readonly size: string;
  readonly installed: boolean;
  readonly thumbnail: string | undefined;
  /** The catalog's latest version, which `thumbnail` is cut from (`tile.version` may be an older one). */
  readonly latest: string | undefined;
  /** The installed copy's cover (`PackManifest.cover`), a path among its own files, when it has one. */
  readonly cover: string | undefined;
  /** The version's `preview.json` and the folder its files are served from, when the catalog lists them. */
  readonly previewUrl: string | undefined;
  readonly baseUrl: string | undefined;
  /** Why `needs-app-update`, in a short line. */
  readonly reason: string | undefined;
  /** False for an installed pack the catalog no longer lists. */
  readonly inCatalog: boolean;
}

/** An installed pack's cover path, read defensively (an install from before covers has none). */
function installedCoverOf(pack: InstalledPack | undefined): string | undefined {
  const cover: unknown = pack?.manifest.cover;
  const files: unknown = pack?.manifest.files;
  if (typeof cover !== "string" || !Array.isArray(files)) return undefined;
  return (files as readonly { path?: unknown }[]).some((file) => file?.path === cover) ? cover : undefined;
}

export function tileOf(entry: PackIndexEntry, context: ModStoreContext): ModStoreTile {
  const installed = context.installed.get(entry.id);
  const view = packStateOf({
    entry,
    installed,
    appVersion: context.appVersion,
    supportedDslFeatures: context.supportedDslFeatures,
  });
  return {
    id: entry.id,
    name: entry.name,
    creator: entry.creator,
    kind: entry.kind,
    kindLabel: KIND_LABELS[entry.kind],
    summary: entry.summary,
    state: view.state,
    stateLabel: STATE_LABELS[view.state],
    version: view.version,
    size: view.size,
    installed: installed !== undefined,
    thumbnail: entry.thumbnail,
    latest: entry.latest,
    cover: installedCoverOf(installed),
    previewUrl: entry.versions[view.version]?.preview,
    baseUrl: entry.versions[view.version]?.base,
    reason: view.reason,
    inCatalog: true,
  };
}

/** An installed pack the catalog no longer lists (the store dropped it): still playable, labelled withdrawn. */
export function orphanTileOf(pack: InstalledPack): ModStoreTile {
  return {
    id: pack.id,
    name: pack.manifest.name,
    creator: pack.manifest.authors.join(", "),
    kind: pack.manifest.kind,
    kindLabel: KIND_LABELS[pack.manifest.kind],
    summary: pack.manifest.description,
    state: "withdrawn",
    stateLabel: STATE_LABELS.withdrawn,
    version: pack.version,
    size: formatBytes(pack.manifest.totalBytes),
    installed: true,
    thumbnail: undefined,
    latest: undefined,
    cover: installedCoverOf(pack),
    previewUrl: undefined,
    baseUrl: undefined,
    reason: undefined,
    inCatalog: false,
  };
}

function inTab(tile: ModStoreTile, tab: ModStoreTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "heroes":
      return tile.kind === "hero";
    case "scenarios":
      return tile.kind === "scenario";
    case "house-rules":
      return tile.kind === "house-rule";
    case "installed":
      return tile.installed;
  }
}

/** The tiles a tab shows, by name. A withdrawn pack nobody installed is not offered; an installed one always shows. */
export function tilesOf(index: PackIndex | null, context: ModStoreContext, tab: ModStoreTab): readonly ModStoreTile[] {
  const tiles: ModStoreTile[] = [];
  const listed = new Set<string>();
  for (const entry of index?.packs ?? []) {
    listed.add(entry.id);
    tiles.push(tileOf(entry, context));
  }
  for (const pack of context.installed.values()) if (!listed.has(pack.id)) tiles.push(orphanTileOf(pack));
  return tiles
    .filter((tile) => (tile.state !== "withdrawn" || tile.installed) && inTab(tile, tab))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type PackActionId = "install" | "update" | "remove" | "confirm-remove" | "cancel-remove";

export interface PackAction {
  readonly id: PackActionId;
  readonly label: string;
  readonly kind: "primary" | "secondary";
  readonly enabled: boolean;
  /** Why it is unavailable. */
  readonly reason?: string;
}

export interface PackActionInput {
  readonly tile: ModStoreTile;
  /** An install or update is running: nothing else can be pressed. */
  readonly busy: boolean;
  /** Remove was pressed once and is waiting for its second press. */
  readonly confirmingRemove: boolean;
}

/** The buttons a pack's page shows, by state. Remove asks twice, so an accidental press deletes nothing. */
export function actionsOf({ tile, busy, confirmingRemove }: PackActionInput): readonly PackAction[] {
  const actions: PackAction[] = [];
  const remove = (): PackAction[] => {
    if (!tile.installed) return [];
    if (confirmingRemove) {
      return [
        { id: "confirm-remove", label: "Remove for good", kind: "primary", enabled: !busy },
        { id: "cancel-remove", label: "Keep it", kind: "secondary", enabled: !busy },
      ];
    }
    return [{ id: "remove", label: "Remove", kind: "secondary", enabled: !busy }];
  };
  if (confirmingRemove && tile.installed) return remove();
  if (tile.state === "install") {
    actions.push({ id: "install", label: `Install (${tile.size})`, kind: "primary", enabled: !busy });
  } else if (tile.state === "update") {
    actions.push({ id: "update", label: `Update to ${tile.version} (${tile.size})`, kind: "primary", enabled: !busy });
  } else if (tile.state === "needs-app-update" && !tile.installed) {
    actions.push({
      id: "install",
      label: "Install",
      kind: "primary",
      enabled: false,
      reason: tile.reason ?? "This pack needs a newer version of the game.",
    });
  }
  actions.push(...remove());
  return actions;
}

/** The progress bar's fill (0 to 1) and its words, for one report from `installPack`. */
export function progressOf(progress: InstallProgress): { readonly fraction: number; readonly text: string } {
  switch (progress.phase) {
    case "download": {
      const share = progress.total > 0 ? Math.min(1, progress.received / progress.total) : 0;
      const text =
        progress.total > 0
          ? `Downloading ${formatBytes(progress.received)} of ${formatBytes(progress.total)}`
          : "Downloading";
      return { fraction: share * 0.6, text };
    }
    case "verify-zip":
      return { fraction: 0.65, text: "Checking the download" };
    case "unzip":
      return { fraction: 0.72, text: "Unzipping" };
    case "verify-files": {
      const share = progress.total > 0 ? progress.done / progress.total : 1;
      return { fraction: 0.75 + share * 0.2, text: `Checking files (${progress.done} of ${progress.total})` };
    }
    case "store":
      return { fraction: 0.97, text: "Saving to this device" };
    case "done":
      return { fraction: 1, text: "Installed" };
  }
}

/** Why an install failed, one sentence each; `errorTextOf` adds what that left behind. */
const ERROR_REASON: Readonly<Record<PackInstallErrorCode, string>> = {
  download: "The download failed. Check your connection and try again.",
  "zip-size": "The download was not the size the store listed.",
  "zip-hash": "The download did not match its checksum.",
  unzip: "The download could not be opened as a pack.",
  "unsafe-path": "The pack holds a file in a place it is not allowed to.",
  "unlisted-file": "The pack holds a file it does not list.",
  "missing-file": "The pack is missing a file it lists.",
  "file-size": "A file in the pack is the wrong size.",
  "file-hash": "A file in the pack did not match its checksum.",
  manifest: "The pack's description file is damaged.",
  "too-large": "The pack is bigger than the game allows.",
  withdrawn: "The store has withdrawn this pack, so it can no longer be installed.",
  mismatch: "The pack is not the one the store listed.",
  store: "The pack could not be saved on this device. There may not be enough free space.",
};

/**
 * A plain-English line for whatever an install or removal threw. Nothing is left half-installed after any of them;
 * `installedVersion` is set for an update, whose failure leaves that version as it was.
 */
export function errorTextOf(error: unknown, installedVersion?: string): string {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  const reason = typeof code === "string" ? ERROR_REASON[code as PackInstallErrorCode] : undefined;
  const left = installedVersion ? `Your installed v${installedVersion} is unchanged.` : "Nothing was installed.";
  if (reason) return `${reason} ${left}`;
  return `Something went wrong. ${installedVersion ? left : "Nothing was changed."} Try again.`;
}

export interface PackPage {
  readonly title: string;
  readonly byline: string;
  /** `Hero pack · v1.0.0 · 1.2 MB`. */
  readonly meta: string;
  /** The scrolling text: description, credits, permission and requirement, as blank-line separated paragraphs. */
  readonly body: string;
  /** Set for `needs-app-update`: the sentence the page also shows above the buttons. */
  readonly requirement: string | undefined;
}

/** The sentence for a pack this game is too old to take: about the update when one is installed, else the pack. */
function requirementOf(tile: ModStoreTile, installed: InstalledPack | undefined): string | undefined {
  if (tile.state !== "needs-app-update") return undefined;
  const need = (tile.reason ?? "Needs a newer version of the game").replace(/^Needs /, "");
  return installed
    ? `The update to v${tile.version} needs a newer game (${need}). Your installed v${installed.version} keeps working.`
    : `This pack needs a newer game (${need}), so it cannot be installed yet.`;
}

/**
 * The pack page's words. The catalog does not carry a pack's license or authors list, so credits come from the
 * installed manifest when there is one and from the catalog's creator otherwise.
 */
export function packPageOf(
  tile: ModStoreTile,
  entry: PackIndexEntry | undefined,
  installed: InstalledPack | undefined,
): PackPage {
  const paragraphs: string[] = [];
  paragraphs.push(installed?.manifest.description || tile.summary || "No description.");
  const authors = installed?.manifest.authors.length ? installed.manifest.authors.join(", ") : tile.creator;
  const license = installed?.manifest.license;
  paragraphs.push(`Credits: made by ${authors}.${license ? ` License: ${license}.` : ""}`);
  paragraphs.push(
    entry
      ? `Permission: listed in the store with the creator's permission, approved ${entry.approved}.`
      : "Permission: this pack is no longer listed in the store. Your installed copy keeps working.",
  );
  if (entry && entry.tags.length > 0) paragraphs.push(`Tags: ${entry.tags.join(", ")}.`);
  const requirement = requirementOf(tile, installed);
  if (requirement) paragraphs.push(requirement);
  const installedNote = installed ? ` (installed: v${installed.version})` : "";
  return {
    title: tile.name,
    byline: `By ${tile.creator}`,
    meta: `${tile.kindLabel} pack · v${tile.version} · ${tile.size}${installedNote}`,
    body: paragraphs.join("\n\n"),
    requirement,
  };
}

/** A pack tile is a wide card, picture left and words right; the grid fills the width in as many columns as fit. */
const MIN_TILE_WIDTH = 300;

export function modStoreGridOf(width: number, phone: boolean): ExtrasGrid {
  const gap = phone ? 10 : 16;
  const columns = Math.max(1, Math.floor((width + gap) / (MIN_TILE_WIDTH + gap)));
  const tileWidth = Math.max(1, (width - gap * (columns - 1)) / columns);
  const tileHeight = phone ? 120 : 136;
  return { columns, gap, tileWidth, tileHeight, rowHeight: tileHeight + gap };
}

/**
 * What a browse tile's left side shows, best first: the pack's cover, the catalog's thumbnail, the featured picture,
 * the featured card's generated face, a letter.
 */
export type TileArt =
  | ({ readonly kind: "cover" } & PackCover)
  | { readonly kind: "thumbnail"; readonly url: string }
  | { readonly kind: "picture"; readonly url: string }
  | { readonly kind: "face"; readonly card: AnyCard; readonly face: CardFace }
  | { readonly kind: "letter" };

/** One featured face of the pack page: the card, which face, and its picture's address when the pack ships one. */
export interface FeaturedFace {
  readonly card: AnyCard;
  readonly face: CardFace;
  readonly pictureUrl: string | undefined;
  /** The picture's path in the pack (`cards/<lang>/<code>.webp`), for an installed pack's own files. */
  readonly path: string | undefined;
}

/**
 * The featured card's faces: a hero's identity shows both (hero and alter-ego), any other card its one face. Empty when
 * the preview names no featured card or its record did not survive validation. A house rule's featured card is an
 * official face it rebuilds (docs/custom-content-packs.md §11.11): `ruleCards` (`officialCardsByPictureCode`) finds
 * its card, and it shows that one face, in the rule's picture.
 */
export function featuredFacesOf(
  preview: ParsedPackPreview | null | undefined,
  base: string | undefined,
  lang?: string,
  ruleCards?: ReadonlyMap<string, AnyCard>,
): readonly FeaturedFace[] {
  const featured = preview?.featured;
  const own = featured ? preview?.cards.find((one) => (one.id as string) === featured.cardId) : undefined;
  const official = !own && featured ? ruleCards?.get(featured.cardId) : undefined;
  if (preview && featured && official) {
    const path = localizedPicturePath(preview, featured.images[0], lang);
    const pictureUrl = path !== undefined && base !== undefined ? `${base}${path}` : undefined;
    return [{ card: official, face: ruleFaceOf(featured.cardId, official), pictureUrl, path }];
  }
  const card = own;
  if (!preview || !featured || !card) return [];
  const faceAt = (face: CardFace, index: number): FeaturedFace => {
    const path = localizedPicturePath(preview, featured.images[index], lang);
    const pictureUrl = path !== undefined && base !== undefined ? `${base}${path}` : undefined;
    return { card, face, pictureUrl, path };
  };
  if (card.type === "hero_identity") return [faceAt({ kind: "hero" }, 0), faceAt({ kind: "alterEgo" }, 1)];
  return [faceAt(defaultFaceFor(card), 0)];
}

/**
 * A featured picture's path in the player's language. The preview names the base language's picture
 * (`cards/<base>/<file>`), so this swaps in `cards/<lang>/<file>` when the pack ships it, else keeps the base one (the
 * same fallback as `previewPictureUrl`).
 */
function localizedPicturePath(
  preview: Pick<ParsedPackPreview, "images" | "languages">,
  path: string | undefined,
  lang: string | undefined,
): string | undefined {
  if (path === undefined || lang === undefined) return path;
  const match = /^cards\/([^/]+)\/(.+)$/.exec(path);
  if (!match || match[1] === lang || !preview.languages?.available.includes(lang)) return path;
  const localized = `cards/${lang}/${match[2]}`;
  return preview.images.has(localized) ? localized : path;
}

/**
 * Where a pack's cover comes from: `path`, the installed copy's own file (no network needed), and `url`, the catalog's
 * thumbnail when the preview says the pack has a cover (`mc-pack build` then writes the cover as `thumb.webp`). At
 * least one is set.
 */
export interface PackCover {
  readonly path: string | undefined;
  readonly url: string | undefined;
}

/** The pack's cover, or undefined when neither the installed copy nor the store's preview has one. */
export function coverOf(tile: ModStoreTile, preview: ParsedPackPreview | null | undefined): PackCover | undefined {
  // The catalog's thumbnail is cut from the latest version: another version's preview does not vouch for it.
  const url = preview?.cover !== undefined && tile.version === tile.latest ? tile.thumbnail : undefined;
  if (tile.cover === undefined && url === undefined) return undefined;
  return { path: tile.cover, url };
}

export function tileArtOf(
  tile: ModStoreTile,
  preview: ParsedPackPreview | null | undefined,
  lang?: string,
  ruleCards?: ReadonlyMap<string, AnyCard>,
): TileArt {
  // A cover is the pack's box art, the same in every language: it leads wherever the pack has one.
  const cover = coverOf(tile, preview);
  if (cover) return { kind: "cover", ...cover };
  const first = featuredFacesOf(preview, tile.baseUrl, lang, ruleCards)[0];
  // Without one, the catalog's thumbnail is cut from the base language's picture: a player in another language the pack
  // ships sees that language's picture instead.
  const localized = first?.pictureUrl !== undefined && first.path !== preview?.featured?.images[0];
  if (tile.thumbnail && !localized) return { kind: "thumbnail", url: tile.thumbnail };
  if (first?.pictureUrl) return { kind: "picture", url: first.pictureUrl };
  if (first) return { kind: "face", card: first.card, face: first.face };
  return { kind: "letter" };
}
