import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, test } from "vitest";
import { copyOf } from "./art-copy.js";

const dir = mkdtempSync(join(tmpdir(), "mc-art-copy-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A JPEG stored 4000 wide by 2000 tall that says "turn me a quarter" (EXIF orientation 6): upright it is 2000x4000. */
async function sidewaysJpeg(name: string): Promise<string> {
  const file = join(dir, name);
  await sharp({ create: { width: 4000, height: 2000, channels: 3, background: "#c33" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toFile(file);
  return file;
}

describe("art copies of a sideways picture", () => {
  test("a roster copy keeps the upright picture's shape", async () => {
    const bytes = await copyOf("roster", await sidewaysJpeg("roster.jpg"), join(dir, "cache"));
    const meta = await sharp(bytes!).metadata();
    // Upright 2000x4000 shrinks to a 2x tile's width (600): 600x1200, not the stored axes' 1760x880.
    expect({ width: meta.width, height: meta.height }).toEqual({ width: 600, height: 1200 });
  });
  test("a display copy keeps the upright picture's shape", async () => {
    const bytes = await copyOf("display", await sidewaysJpeg("display.jpg"), join(dir, "cache"));
    const meta = await sharp(bytes!).metadata();
    // Upright 2000x4000: its short edge (2000) is already under the 2160 cap, so it is not resized.
    expect({ width: meta.width, height: meta.height }).toEqual({ width: 2000, height: 4000 });
  });
});
