/**
 * Custom content packs (docs/custom-content-packs.md §5 and §11): the shape of a pack's `pack.json` and of the mod
 * store's `index.json` catalog. A pack is data only (§6): card records, ability definitions, scenarios and decks as
 * JSON, plus images. Nothing here imports the engine, so the client, the mod SDK and the build scripts can all read it.
 */

/** What a pack adds. Only `hero` and `scenario` are planned for the first store version (§11). */
export type PackKind = "hero" | "scenario" | "modular" | "campaign" | "art";

export const PACK_KINDS: readonly PackKind[] = ["hero", "scenario", "modular", "campaign", "art"];

/** The current `pack.json` schema version. */
export const PACK_SCHEMA_VERSION = 1;

/** The current store `index.json` schema version (§11.5). */
export const PACK_INDEX_SCHEMA_VERSION = 2;

/** One file shipped in a pack, so a download can be verified file by file (§5.1). */
export interface PackFile {
  /** The file's path inside the pack, with `/` separators and no leading `/` or `..`. */
  readonly path: string;
  readonly bytes: number;
  /** Lowercase hex sha256 of the file's bytes. */
  readonly sha256: string;
}

/** What a client needs to load a pack (§6, §11.2). */
export interface PackRequires {
  /** A semver range on the app's version, e.g. `">=0.40.0"`. */
  readonly app: string;
  /** The DSL features the pack's abilities use, checked against the client's own list. */
  readonly dslFeatures: readonly string[];
  /** Ids of other packs this one needs (a scenario that uses a fan modular set). */
  readonly packs: readonly string[];
}

/** The data files a pack carries, as paths inside the pack. */
export interface PackContents {
  readonly cards: string;
  readonly abilities?: string;
  readonly scenarios?: string;
  readonly decks?: string;
}

/** A pack's `pack.json` (§5.1). */
export interface PackManifest {
  readonly schema: typeof PACK_SCHEMA_VERSION;
  /** Lowercase letters, digits and `-`; the `x.<id>.` prefix of every custom card code. */
  readonly id: string;
  /** Semver. */
  readonly version: string;
  readonly kind: PackKind;
  readonly name: string;
  readonly authors: readonly string[];
  readonly description: string;
  readonly requires: PackRequires;
  readonly contents: PackContents;
  /** Full-bleed pictures by role, then by card code: `{ hero: { "x.fan-x.01a": "pictures/hero.webp" } }`. */
  readonly pictures?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Every file in the pack except `pack.json` itself. */
  readonly files: readonly PackFile[];
  readonly totalBytes: number;
  readonly license: string;
}

/** One published version of a pack in the store catalog (§5.2). */
export interface PackIndexVersion {
  readonly manifest: string;
  readonly base: string;
  readonly zip: string;
  /** A second address for the zip, for native clients (§5.2). */
  readonly zipFallback?: string;
  readonly zipBytes: number;
  readonly zipSha256: string;
  readonly requires: Pick<PackRequires, "app"> & Partial<Pick<PackRequires, "dslFeatures" | "packs">>;
}

/** One pack in the store catalog (§11.5). */
export interface PackIndexEntry {
  readonly id: string;
  readonly kind: PackKind;
  readonly name: string;
  readonly creator: string;
  /** One line for the store list. */
  readonly summary: string;
  readonly tags: readonly string[];
  readonly thumbnail?: string;
  /** The date the owner approved the pack, `YYYY-MM-DD`. */
  readonly approved: string;
  readonly latest: string;
  readonly versions: Readonly<Record<string, PackIndexVersion>>;
  /** Withdrawn packs stay playable where installed, but the store doesn't offer them (§11.4). */
  readonly withdrawn: boolean;
}

/** The store's `index.json` (§11.5). */
export interface PackIndex {
  readonly schema: typeof PACK_INDEX_SCHEMA_VERSION;
  /** ISO 8601 time the catalog was generated. */
  readonly generated: string;
  readonly packs: readonly PackIndexEntry[];
}

const PACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Whether `id` is a legal pack id. */
export function isPackId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && PACK_ID.test(id);
}

/** The prefix every card code in pack `packId` starts with: `x.<pack-id>.` (§3). */
export function customCardPrefix(packId: string): string {
  return `x.${packId}.`;
}

/** Whether `code` is a custom card code (`x.<pack-id>.<rest>`), which can never collide with a MarvelCDB code. */
export function isCustomCardCode(code: string): boolean {
  return code.startsWith("x.");
}

/** The pack id a custom card code belongs to, or `undefined` for a base-game code. */
export function packIdOfCardCode(code: string): string | undefined {
  if (!isCustomCardCode(code)) return undefined;
  const end = code.indexOf(".", 2);
  return end > 2 ? code.slice(2, end) : undefined;
}

/** Whether a pack file path is safe to store and serve: relative, `/`-separated, no `..`, no empty segment. */
export function isSafePackPath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\")) return false;
  return path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}
