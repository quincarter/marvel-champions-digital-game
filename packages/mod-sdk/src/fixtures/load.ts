import { fileURLToPath } from "node:url";
import { assemblePack, loadPackSource } from "../build.js";
import type { PackInput } from "../validate.js";

/** The fixture pack's source folder. */
export const TINY_PACK_DIR = fileURLToPath(new URL("./tiny-pack", import.meta.url));

/** The fixture pack, built in memory (what `buildPack` would write). */
export async function tinyPack(): Promise<PackInput> {
  return assemblePack(await loadPackSource(TINY_PACK_DIR));
}

/**
 * A WebP file's header, padded to `bytes` (at least 30): enough for `webpSize` to read `width` x `height` (an extended
 * `VP8X` header), not a picture a browser could draw. For cover tests.
 */
export function fakeWebp(width: number, height: number, bytes = 64): Uint8Array {
  const out = new Uint8Array(Math.max(30, bytes));
  const put = (at: number, text: string): void => text.split("").forEach((c, i) => (out[at + i] = c.charCodeAt(0)));
  const u24 = (at: number, value: number): void => {
    out[at] = value & 0xff;
    out[at + 1] = (value >> 8) & 0xff;
    out[at + 2] = (value >> 16) & 0xff;
  };
  put(0, "RIFF");
  u24(4, out.length - 8);
  put(8, "WEBPVP8X");
  out[16] = 10;
  u24(24, width - 1);
  u24(27, height - 1);
  return out;
}
