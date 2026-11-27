/**
 * The pipeline behind `vite-roster-art.ts`: shrinks a picture under `art/` to its `kind` copy with `sharp` and keeps the
 * result in `node_modules/.cache/mc-art-copies`, keyed by the source's path, size and mtime, the copy's size and
 * quality and the sharp version, so a rebuild only shrinks what changed. Build-time only (Node); nothing here ships.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROSTER_QUALITY, copySizeFor, type CopyKind } from "./roster-size.js";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The pictures' root and the copies' cache, from the repo root. */
export const ART_ROOT = resolve(HERE, "../../../../art");
const CACHE = resolve(HERE, "../../../../node_modules/.cache/mc-art-copies");
const QUALITY: Record<CopyKind, number> = { roster: ROSTER_QUALITY, display: 78 };
/** Bump when the copy settings change in a way the cache key does not see. */
const CACHE_VERSION = 1;

/** The sharp release, in the cache key. */
const sharpVersion = ((): string => {
  try {
    return (createRequire(import.meta.url)("sharp/package.json") as { version: string }).version;
  } catch {
    return "none";
  }
})();

interface Sharp {
  (input: string): {
    metadata: () => Promise<{ width?: number; height?: number; orientation?: number }>;
    rotate: () => {
      resize: (o: object) => { webp: (o: object) => { toBuffer: () => Promise<Buffer> } };
    };
  };
}

let sharpPromise: Promise<Sharp | null> | null = null;
function loadSharp(): Promise<Sharp | null> {
  sharpPromise ??= import("sharp").then(
    (m) => (m as unknown as { default: Sharp }).default,
    () => {
      console.warn("[art-copy] sharp is not installed; pictures ship at full size.");
      return null;
    },
  );
  return sharpPromise;
}

/** The copy's bytes (cached on disk), or null without `sharp`. Throws when sharp cannot read the file. */
export async function copyOf(kind: CopyKind, file: string, cacheDir: string = CACHE): Promise<Buffer | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  const stat = statSync(file);
  const meta = await sharp(file).metadata();
  // The stored axes of a picture saved on its side (EXIF orientation 5 to 8) are swapped from what `.rotate()` makes of
  // it; sizing by the stored ones would squash the upright picture into the wrong shape.
  const sideways = (meta.orientation ?? 1) >= 5;
  const size = copySizeFor(
    kind,
    (sideways ? meta.height : meta.width) ?? 0,
    (sideways ? meta.width : meta.height) ?? 0,
  );
  const name = createHash("sha1")
    .update(
      [
        CACHE_VERSION,
        sharpVersion,
        kind,
        resolve(file).replaceAll("\\", "/"),
        stat.size,
        Math.round(stat.mtimeMs),
        size.width,
        size.height,
        QUALITY[kind],
      ].join("|"),
    )
    .digest("hex");
  const cached = join(cacheDir, `${name}.webp`);
  if (existsSync(cached)) return readFileSync(cached);
  // `.rotate()` applies the EXIF orientation first, so the size above (the upright picture's) is what it is resized to.
  const bytes = await sharp(file)
    .rotate()
    .resize({ width: size.width, height: size.height, fit: "fill" })
    .webp({ quality: QUALITY[kind] })
    .toBuffer();
  // The copy is still the answer when the cache cannot be written (a read-only or full disk).
  try {
    mkdirSync(cacheDir, { recursive: true });
    const temp = `${cached}.${process.pid}.tmp`;
    writeFileSync(temp, bytes);
    renameSync(temp, cached);
  } catch {
    // Not cached; it is made again next time.
  }
  return bytes;
}
