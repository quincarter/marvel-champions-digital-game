/** Lists the repo's own card scans (`assets/card-art/bundles/cards/`) by code, for `withLocalArt`. */
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CARD_ART_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "assets", "card-art", "bundles", "cards");

/** Every `<code>.png` in the art folder, as its code. Empty when the folder is absent (a checkout without art). */
export async function localArtCodes(): Promise<ReadonlySet<string>> {
  try {
    const files = await readdir(CARD_ART_DIR);
    return new Set(files.filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -".png".length)));
  } catch {
    return new Set();
  }
}
