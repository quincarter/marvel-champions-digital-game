/**
 * The Mod Store screen's logic (docs/custom-content-packs.md §11.6), kept out of the scene: which packs a tab shows, what
 * a tile says, which buttons a pack's state offers, how far an install has got and what a failure means in plain
 * English. Everything here is pure; the scene (`scenes/mod-store.ts`) only draws it.
 *
 * Nothing here decides whether a pack can be installed: `packs/pack-state.ts` does, and this reads its answer.
 */
import type { PackIndex, PackIndexEntry, PackKind } from "@mc/content";
import { packStateOf, formatBytes, type PackState } from "../packs/pack-state.js";
import type { InstalledPack } from "../packs/pack-store.js";
import type { InstallProgress } from "../packs/install-pack.js";
import type { ExtrasGrid } from "./extras-model.js";

export type ModStoreTab = "all" | "heroes" | "scenarios" | "installed";

export const MOD_STORE_TABS: readonly { readonly id: ModStoreTab; readonly label: string }[] = [
  { id: "all", label: "All" },
  { id: "heroes", label: "Heroes" },
  { id: "scenarios", label: "Scenarios" },
  { id: "installed", label: "Installed" },
];

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
  /** Why `needs-app-update`, in a short line. */
  readonly reason: string | undefined;
  /** False for an installed pack the catalog no longer lists. */
  readonly inCatalog: boolean;
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

const ERROR_TEXT: Readonly<Record<string, string>> = {
  download: "The download failed. Check your connection and try again.",
  "zip-size": "The download was not the size the store listed, so nothing was installed.",
  "zip-hash": "The download did not match its checksum, so nothing was installed.",
  unzip: "The download could not be opened as a pack, so nothing was installed.",
  "unsafe-path": "The pack holds a file in a place it is not allowed to, so nothing was installed.",
  "unlisted-file": "The pack holds a file it does not list, so nothing was installed.",
  "missing-file": "The pack is missing a file it lists, so nothing was installed.",
  "file-size": "A file in the pack is the wrong size, so nothing was installed.",
  "file-hash": "A file in the pack did not match its checksum, so nothing was installed.",
  manifest: "The pack's description file is damaged, so nothing was installed.",
  mismatch: "The pack is not the one the store listed, so nothing was installed.",
  store: "The pack could not be saved on this device. There may not be enough free space.",
};

/** A plain-English line for whatever an install or removal threw. Nothing is left half-installed after any of them. */
export function errorTextOf(error: unknown): string {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  if (typeof code === "string" && ERROR_TEXT[code]) return ERROR_TEXT[code]!;
  return "Something went wrong, and nothing was changed. Try again.";
}

export interface PackPage {
  readonly title: string;
  readonly byline: string;
  /** `Hero pack · v1.0.0 · 1.2 MB`. */
  readonly meta: string;
  /** The scrolling text: description, credits, permission and requirement, as blank-line separated paragraphs. */
  readonly body: string;
  /** Set for `needs-app-update`: the line the page also shows above the buttons. */
  readonly requirement: string | undefined;
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
  const requirement =
    tile.state === "needs-app-update" ? (tile.reason ?? "Needs a newer version of the game.") : undefined;
  if (requirement) paragraphs.push(`Requires: ${requirement}.`);
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
  const tileHeight = phone ? 104 : 120;
  return { columns, gap, tileWidth, tileHeight, rowHeight: tileHeight + gap };
}
