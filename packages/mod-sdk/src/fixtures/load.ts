import { fileURLToPath } from "node:url";
import { assemblePack, loadPackSource } from "../build.js";
import type { PackInput } from "../validate.js";

/** The fixture pack's source folder. */
export const TINY_PACK_DIR = fileURLToPath(new URL("./tiny-pack", import.meta.url));

/** The fixture pack, built in memory (what `buildPack` would write). */
export async function tinyPack(): Promise<PackInput> {
  return assemblePack(await loadPackSource(TINY_PACK_DIR));
}
