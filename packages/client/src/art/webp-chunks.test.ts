import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * The Linux app (WebKitGTK) drew hero tiles blank for exactly the pictures whose WebP carried a colour profile or
 * metadata chunks (ICCP, EXIF, XMP), decoded through `createImageBitmap` in the card-face worker (the owner, on a
 * Steam Deck, 2026-10-24). Every other picture there is a plain WebP, so the art folder keeps to that: a lossy or
 * lossless image, with an alpha chunk where it needs one, and nothing else.
 */

const ART = join(dirname(fileURLToPath(import.meta.url)), "../../../../art");
const ALLOWED = new Set(["VP8X", "VP8 ", "VP8L", "ALPH"]);

function webpFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return webpFiles(path);
    return name.endsWith(".webp") ? [path] : [];
  });
}

function chunksOf(bytes: Buffer): string[] {
  const out: string[] = [];
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(at + 4);
    out.push(bytes.toString("latin1", at, at + 4));
    at += 8 + size + (size & 1);
  }
  return out;
}

describe("art WebP files", () => {
  test("carry no colour profile or metadata chunks", () => {
    const extra = webpFiles(ART).flatMap((path) => {
      const unexpected = chunksOf(readFileSync(path)).filter((chunk) => !ALLOWED.has(chunk));
      return unexpected.length ? [`${relative(ART, path)}: ${unexpected.join(", ")}`] : [];
    });
    expect(extra).toEqual([]);
  });
});
