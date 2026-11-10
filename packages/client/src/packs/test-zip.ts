/** Test helper: builds a pack zip, its manifest and the catalog entry for it. Not shipped (only tests import it). */
import { createHash } from "node:crypto";
import type { PackIndexEntry, PackManifest } from "@mc/content";
import { zipSync } from "fflate";

const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const enc = (text: string): Uint8Array => new TextEncoder().encode(text);

export interface BuiltPack {
  readonly zip: Uint8Array;
  readonly manifest: PackManifest;
  readonly entry: PackIndexEntry;
  readonly contents: Record<string, Uint8Array>;
}

export function buildPack(
  options: {
    id?: string;
    version?: string;
    /** Replaces the zip's bytes for a path after the manifest is computed (tampering). */
    tamper?: Record<string, Uint8Array>;
    /** Extra zip entries the manifest does not list. */
    extra?: Record<string, Uint8Array>;
    zipFallback?: string;
    manifestOverride?: Partial<PackManifest>;
    /** Contents paths left out of the zip (but still in the manifest). */
    omit?: string[];
  } = {},
): BuiltPack {
  const id = options.id ?? "fan-test";
  const version = options.version ?? "1.0.0";
  const contents: Record<string, Uint8Array> = {
    "data/cards.json": enc(JSON.stringify([{ code: `x.${id}.01` }])),
    "pictures/hero.webp": new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
  };
  const files = Object.entries(contents).map(([path, bytes]) => ({
    path,
    bytes: bytes.byteLength,
    sha256: sha(bytes),
  }));
  const manifest: PackManifest = {
    schema: 1,
    id,
    version,
    kind: "hero",
    name: "Test",
    authors: ["t"],
    description: "d",
    requires: { app: ">=0.1.0", dslFeatures: [], packs: [] },
    contents: { cards: "data/cards.json" },
    files,
    totalBytes: files.reduce((n, f) => n + f.bytes, 0),
    license: "CC-BY-4.0",
    ...options.manifestOverride,
  };
  const zip = zipSync({
    "pack.json": enc(JSON.stringify(manifest)),
    ...Object.fromEntries(Object.entries(contents).filter(([path]) => !options.omit?.includes(path))),
    ...options.tamper,
    ...options.extra,
  });
  const entry: PackIndexEntry = {
    id,
    kind: "hero",
    name: "Test",
    creator: "t",
    summary: "s",
    tags: [],
    approved: "2026-11-12",
    latest: version,
    withdrawn: false,
    versions: {
      [version]: {
        manifest: `https://packs.test/${id}/${version}/pack.json`,
        base: `https://packs.test/${id}/${version}/`,
        zip: `https://packs.test/${id}/${version}/pack.zip`,
        ...(options.zipFallback ? { zipFallback: options.zipFallback } : {}),
        zipBytes: zip.byteLength,
        zipSha256: sha(zip),
        requires: { app: ">=0.1.0" },
      },
    },
  };
  return { zip, manifest, entry, contents };
}
