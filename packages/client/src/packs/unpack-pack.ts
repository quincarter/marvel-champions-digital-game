/**
 * Checking and unpacking a pack's zip (docs/custom-content-packs.md §7.2): the zip's size and sha256 against the
 * catalog, safe paths only, only files the manifest lists, each file's bytes and sha256, and `pack.json` against the
 * catalog's id and version. Plain functions with no worker or DOM dependency; `pack-install.worker.ts` wraps
 * them so the hashing and inflating run off the main thread, and the tests call them directly.
 */
import { isPackId, isSafePackPath, PACK_KINDS, PACK_SCHEMA_VERSION, type PackManifest } from "@mc/content";
import { unzipSync } from "fflate";

export const PACK_JSON = "pack.json";

/** What the catalog promises about the zip. */
export interface UnpackExpect {
  readonly id: string;
  readonly version: string;
  readonly zipBytes: number;
  readonly zipSha256: string;
  /** When given, pack.json's `kind` and `requires.app` must equal these (the catalog's promises). */
  readonly kind?: string;
  readonly requiresApp?: string;
}

/** A pack.json is read whole, so it is capped; no real manifest comes near this. */
export const MAX_MANIFEST_BYTES = 1024 * 1024;
/** The most a pack may inflate to in total, whatever its manifest claims. */
export const MAX_PACK_BYTES = 512 * 1024 * 1024;

export type UnpackStep = "verify-zip" | "unzip" | "verify-files";

export type UnpackProgress =
  | { readonly step: "verify-zip" }
  | { readonly step: "unzip" }
  | { readonly step: "verify-files"; readonly done: number; readonly total: number };

export type PackInstallErrorCode =
  | "download"
  | "zip-size"
  | "zip-hash"
  | "unzip"
  | "unsafe-path"
  | "unlisted-file"
  | "missing-file"
  | "file-size"
  | "file-hash"
  | "manifest"
  | "too-large"
  | "withdrawn"
  | "mismatch"
  | "store";

export class PackInstallError extends Error {
  constructor(
    readonly code: PackInstallErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PackInstallError";
  }
}

export interface UnpackedPack {
  readonly manifest: PackManifest;
  /** Every file the manifest lists, by path (not `pack.json`). */
  readonly files: Map<string, Uint8Array>;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function bad(message: string): never {
  throw new PackInstallError("manifest", message);
}

/** Parses pack.json and checks it has the shape of a `PackManifest` (types.ts is only a compile-time promise). */
function parseManifest(bytes: Uint8Array): PackManifest {
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return bad("pack.json is not valid JSON");
  }
  if (!isObject(data)) return bad("pack.json is not an object");
  if (data.schema !== PACK_SCHEMA_VERSION) return bad("pack.json has an unsupported schema");
  if (typeof data.id !== "string" || !isPackId(data.id)) return bad("pack.json has an invalid id");
  if (typeof data.version !== "string") return bad("pack.json has no version");
  if (typeof data.kind !== "string" || !(PACK_KINDS as readonly string[]).includes(data.kind)) {
    return bad("pack.json has an unknown kind");
  }
  for (const key of ["name", "description", "license"] as const) {
    if (typeof data[key] !== "string") return bad(`pack.json has no ${key}`);
  }
  if (!isStrings(data.authors)) return bad("pack.json has invalid authors");
  const requires = data.requires;
  if (
    !isObject(requires) ||
    typeof requires.app !== "string" ||
    !isStrings(requires.dslFeatures) ||
    !isStrings(requires.packs)
  ) {
    return bad("pack.json has an invalid requires block");
  }
  const contents = data.contents;
  if (!isObject(contents) || typeof contents.cards !== "string") return bad("pack.json has no contents.cards");
  for (const key of ["abilities", "scenarios", "decks"]) {
    if (contents[key] !== undefined && typeof contents[key] !== "string")
      return bad(`pack.json has invalid contents.${key}`);
  }
  if (!Array.isArray(data.files)) return bad("pack.json has no file list");
  let sum = 0;
  const paths = new Set<string>();
  for (const f of data.files) {
    if (
      !isObject(f) ||
      typeof f.path !== "string" ||
      typeof f.bytes !== "number" ||
      !Number.isInteger(f.bytes) ||
      f.bytes < 0 ||
      typeof f.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/i.test(f.sha256)
    ) {
      return bad("pack.json has an invalid file entry");
    }
    if (f.path === PACK_JSON || paths.has(f.path)) return bad(`pack.json lists ${f.path} twice or lists itself`);
    paths.add(f.path);
    sum += f.bytes;
  }
  if (data.totalBytes !== sum) return bad("pack.json's totalBytes does not match its file list");
  if (!paths.has(contents.cards)) return bad("pack.json's contents.cards is not a listed file");
  return data as unknown as PackManifest;
}

export async function unpackPack(
  zip: Uint8Array,
  expect: UnpackExpect,
  onProgress: (progress: UnpackProgress) => void = () => {},
): Promise<UnpackedPack> {
  onProgress({ step: "verify-zip" });
  if (zip.byteLength !== expect.zipBytes) {
    throw new PackInstallError("zip-size", `The download is ${zip.byteLength} bytes, expected ${expect.zipBytes}`);
  }
  if ((await sha256Hex(zip)) !== expect.zipSha256.toLowerCase()) {
    throw new PackInstallError("zip-hash", "The download does not match its checksum");
  }

  onProgress({ step: "unzip" });
  // Pass 1 reads only pack.json, and reports every entry name so unsafe ones are refused before anything inflates.
  const names: string[] = [];
  let manifestBytes: Uint8Array | undefined;
  try {
    const first = unzipSync(zip, {
      filter: (file) => {
        names.push(file.name);
        if (file.name !== PACK_JSON) return false;
        if (file.originalSize > MAX_MANIFEST_BYTES) {
          throw new PackInstallError("too-large", "pack.json is larger than a manifest can be");
        }
        return true;
      },
    });
    manifestBytes = first[PACK_JSON];
  } catch (error) {
    if (error instanceof PackInstallError) throw error;
    throw new PackInstallError("unzip", "The download is not a readable zip");
  }
  const entries = names.filter((name) => !name.endsWith("/"));
  const entrySet = new Set(entries);
  for (const name of entries) {
    if (!isSafePackPath(name)) throw new PackInstallError("unsafe-path", `Unsafe path in the pack: ${name}`);
  }
  if (!manifestBytes) throw new PackInstallError("manifest", "The pack has no pack.json");
  const manifest = parseManifest(manifestBytes);
  if (manifest.id !== expect.id || manifest.version !== expect.version) {
    throw new PackInstallError(
      "mismatch",
      `pack.json is ${manifest.id}@${manifest.version}, the catalog listed ${expect.id}@${expect.version}`,
    );
  }

  if (
    (expect.kind !== undefined && manifest.kind !== expect.kind) ||
    (expect.requiresApp !== undefined && manifest.requires.app !== expect.requiresApp)
  ) {
    throw new PackInstallError("mismatch", "pack.json's kind or app requirement differs from the catalog's");
  }
  if (manifest.totalBytes > MAX_PACK_BYTES) {
    throw new PackInstallError("too-large", "The pack inflates to more than the allowed size");
  }

  const listed = new Map(manifest.files.map((f) => [f.path, f]));
  for (const file of manifest.files) {
    if (!isSafePackPath(file.path))
      throw new PackInstallError("unsafe-path", `Unsafe path in the manifest: ${file.path}`);
  }
  for (const name of entries) {
    if (name !== PACK_JSON && !listed.has(name)) {
      throw new PackInstallError("unlisted-file", `The zip holds ${name}, which pack.json does not list`);
    }
  }
  for (const path of listed.keys()) {
    if (!entrySet.has(path)) throw new PackInstallError("missing-file", `pack.json lists ${path}, the zip lacks it`);
  }

  // Pass 2 inflates only listed files whose declared size matches, so a zip bomb never inflates.
  let inflated: Record<string, Uint8Array>;
  try {
    inflated = unzipSync(zip, {
      filter: (file) => {
        const entry = listed.get(file.name);
        if (!entry) return false;
        if (file.originalSize !== entry.bytes) {
          throw new PackInstallError(
            "file-size",
            `${file.name} is ${file.originalSize} bytes, expected ${entry.bytes}`,
          );
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof PackInstallError) throw error;
    throw new PackInstallError("unzip", "The download is not a readable zip");
  }

  const files = new Map<string, Uint8Array>();
  let done = 0;
  for (const entry of manifest.files) {
    const bytes = inflated[entry.path];
    if (!bytes) throw new PackInstallError("missing-file", `pack.json lists ${entry.path}, the zip lacks it`);
    if (bytes.byteLength !== entry.bytes) {
      throw new PackInstallError("file-size", `${entry.path} is ${bytes.byteLength} bytes, expected ${entry.bytes}`);
    }
    if ((await sha256Hex(bytes)) !== entry.sha256.toLowerCase()) {
      throw new PackInstallError("file-hash", `${entry.path} does not match its checksum`);
    }
    files.set(entry.path, bytes);
    onProgress({ step: "verify-files", done: ++done, total: manifest.files.length });
  }
  return { manifest, files };
}
