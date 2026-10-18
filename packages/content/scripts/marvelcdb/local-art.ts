/** Lists the repo's own card scans (`assets/card-art/bundles/cards/`) by code, for `withLocalArt`. */
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ART_BY_CODE } from "./normalize/core-raw.ts";

const CARD_ART_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "assets",
  "card-art",
  "bundles",
  "cards",
);

/** Every `<code>.png` in the art folder, as its code. Empty when the folder is absent (a checkout without art). */
export async function localArtCodes(): Promise<ReadonlySet<string>> {
  try {
    const files = await readdir(CARD_ART_DIR);
    return new Set(files.filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -".png".length)));
  } catch {
    return new Set();
  }
}

/**
 * Lets the cross-pack reprint lookup (`reprintImages`, by `duplicate_of_code`) see local scans for originals whose raw
 * record has no `imagesrc` (Unbreakable Bond 62024 reprints jj 61027). Never overrides a raw `imagesrc`. Call it
 * wherever `withLocalArt` is, so ingest and survey agree.
 */
export function seedLocalArtByCode(localCodes: ReadonlySet<string>): void {
  for (const code of localCodes) if (!ART_BY_CODE.has(code)) ART_BY_CODE.set(code, `/bundles/cards/${code}.png`);
}
