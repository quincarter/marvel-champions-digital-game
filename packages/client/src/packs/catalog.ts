/**
 * The store's `index.json` (docs/custom-content-packs.md §11.5): fetched when the store opens, validated, and the last
 * good copy kept so the store opens offline.
 */
import { isPackId, PACK_INDEX_SCHEMA_VERSION, PACK_KINDS, type PackIndex, type PackIndexEntry } from "@mc/content";
import { packFetchFor } from "./pack-fetch.js";

/** Where approved packs are served from: the R2 bucket's custom domain (§11.8). */
export const PACKS_HOST = "https://packs.champions-digital-game.com";

/**
 * The store's catalog. A dev server reads the local `public/packs/index.json`; every build, Netlify's included, reads
 * the production catalog on R2, which the game repo's publish-packs workflow and the registry repo write.
 */
export const CATALOG_URL = import.meta.env?.DEV ? "/packs/index.json" : `${PACKS_HOST}/index.json`;
export const CATALOG_CACHE_KEY = "mc-pack-catalog";

/** `maxBytes` refuses a response bigger than that, before or while its body is read (`pack-fetch.ts`). */
export type FetchInit = RequestInit & { readonly maxBytes?: number };
export type FetchLike = (url: string, init?: FetchInit) => Promise<Response>;

export interface CatalogDeps {
  readonly fetch?: FetchLike;
  readonly url?: string;
  /** Where the last good copy lives; defaults to `localStorage` when there is one. */
  readonly storage?: Pick<Storage, "getItem" | "setItem"> | null;
}

export interface CatalogResult {
  readonly index: PackIndex;
  /** True when the network failed and this is the cached copy. */
  readonly offline: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[0-9a-f]{64}$/;

function validVersion(v: unknown): boolean {
  return (
    isRecord(v) &&
    isString(v.manifest) &&
    isString(v.base) &&
    isString(v.zip) &&
    (v.zipFallback === undefined || isString(v.zipFallback)) &&
    (v.preview === undefined || isString(v.preview)) &&
    typeof v.zipBytes === "number" &&
    Number.isInteger(v.zipBytes) &&
    v.zipBytes > 0 &&
    isString(v.zipSha256) &&
    SHA256.test(v.zipSha256) &&
    isRecord(v.requires) &&
    isString(v.requires.app) &&
    (v.requires.dslFeatures === undefined || isStringArray(v.requires.dslFeatures)) &&
    (v.requires.packs === undefined || isStringArray(v.requires.packs))
  );
}

function validEntry(e: unknown): e is PackIndexEntry {
  return (
    isRecord(e) &&
    isString(e.id) &&
    isPackId(e.id) &&
    isString(e.kind) &&
    (PACK_KINDS as readonly string[]).includes(e.kind) &&
    isString(e.name) &&
    isString(e.creator) &&
    isString(e.summary) &&
    isStringArray(e.tags) &&
    (e.thumbnail === undefined || isString(e.thumbnail)) &&
    isString(e.approved) &&
    isString(e.latest) &&
    typeof e.withdrawn === "boolean" &&
    isRecord(e.versions) &&
    Object.keys(e.versions).every((key) => SEMVER.test(key)) &&
    Object.values(e.versions).every(validVersion) &&
    Object.prototype.hasOwnProperty.call(e.versions, e.latest)
  );
}

/** The index when `data` has the catalog's shape. Entries that are malformed are dropped, not fatal. */
export function parseCatalog(data: unknown): PackIndex | undefined {
  if (!isRecord(data) || data.schema !== PACK_INDEX_SCHEMA_VERSION || !isString(data.generated)) return undefined;
  if (!Array.isArray(data.packs)) return undefined;
  return {
    schema: PACK_INDEX_SCHEMA_VERSION,
    generated: data.generated,
    packs: data.packs.filter(validEntry),
  };
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The cached copy, if there is a valid one. */
export function cachedCatalog(storage: CatalogDeps["storage"] = defaultStorage()): PackIndex | undefined {
  try {
    const raw = storage?.getItem(CATALOG_CACHE_KEY);
    return raw ? parseCatalog(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

/** Fetches the catalog; on any failure falls back to the cached copy, and throws only when there is neither. */
export async function loadCatalog(deps: CatalogDeps = {}): Promise<CatalogResult> {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const doFetch: FetchLike = deps.fetch ?? packFetchFor();
  try {
    const response = await doFetch(deps.url ?? CATALOG_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    const index = parseCatalog(await response.json());
    if (!index) throw new Error("The pack catalog has an unexpected shape");
    try {
      storage?.setItem(CATALOG_CACHE_KEY, JSON.stringify(index));
    } catch {
      // Quota or private mode: the catalog still works this session.
    }
    return { index, offline: false };
  } catch (error) {
    const cached = cachedCatalog(storage);
    if (cached) return { index: cached, offline: true };
    throw error;
  }
}
