/**
 * Checking and unpacking a pack's zip (docs/custom-content-packs.md §7.2): the zip's size and sha256 against the
 * catalog, safe paths only, only files the manifest lists, each file's bytes and sha256, and `pack.json` against the
 * catalog's id and version. Plain functions with no worker or DOM dependency; `workers/pack-install.worker.ts` wraps
 * them so the hashing and inflating run off the main thread, and the tests call them directly.
 */
import { isSafePackPath, type PackManifest } from "@mc/content";
import { unzipSync } from "fflate";

export const PACK_JSON = "pack.json";

/** What the catalog promises about the zip. */
export interface UnpackExpect {
  readonly id: string;
  readonly version: string;
  readonly zipBytes: number;
  readonly zipSha256: string;
}

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

function parseManifest(bytes: Uint8Array): PackManifest {
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PackInstallError("manifest", "pack.json is not valid JSON");
  }
  const m = data as Partial<PackManifest> | null;
  if (
    !m ||
    typeof m !== "object" ||
    typeof m.id !== "string" ||
    typeof m.version !== "string" ||
    !Array.isArray(m.files) ||
    !m.files.every(
      (f) => f && typeof f.path === "string" && typeof f.bytes === "number" && typeof f.sha256 === "string",
    )
  ) {
    throw new PackInstallError("manifest", "pack.json is missing its id, version or file list");
  }
  return m as PackManifest;
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
        return file.name === PACK_JSON;
      },
    });
    manifestBytes = first[PACK_JSON];
  } catch {
    throw new PackInstallError("unzip", "The download is not a readable zip");
  }
  const entries = names.filter((name) => !name.endsWith("/"));
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
    if (!entries.includes(path))
      throw new PackInstallError("missing-file", `pack.json lists ${path}, the zip lacks it`);
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
