/**
 * Writes each pack curation's `addedRecords` (card faces MarvelCDB lacks, transcribed from scans) as a raw-shaped
 * JSON file (the MarvelCDB cache shape: { source, pack, cards }) under `raw/hallofheroes/<pack>.json`, so tools
 * that read raw caches (`scripts/generate_cards_markdown.py`) see them too. Back faces stay nested as `linked_card`, as MarvelCDB sends them. Generated: edit the curation, not the
 * output. Only packs whose added records are whole cards are listed (aoa's single added back face is reached through
 * a link override, so it stays out).
 *
 *   pnpm --filter @mc/content export-added-records            # every curation that has addedRecords
 *   pnpm --filter @mc/content export-added-records -- fne     # one pack
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FNE_CURATION } from "./marvelcdb/curation/fne.ts";
import { SHADOWLAND_CURATION } from "./marvelcdb/curation/shadowland.ts";
import type { PackCuration } from "./marvelcdb/curation/types.ts";

const CURATIONS: readonly PackCuration[] = [FNE_CURATION, SHADOWLAND_CURATION];

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "raw", "hallofheroes");
const only = process.argv.slice(2).filter((a) => a !== "--");

for (const curation of CURATIONS) {
  if (only.length > 0 && !only.includes(curation.packCode)) continue;
  // A record added only as another record's back face is reached through that front's `linked_card`.
  const nestedCodes = new Set(
    (curation.addedRecords ?? []).flatMap(({ record }) => (record.linked_card ? [record.linked_card.code] : [])),
  );
  const records = (curation.addedRecords ?? []).map(({ record }) => record).filter((r) => !nestedCodes.has(r.code));
  if (records.length === 0) continue;
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${curation.packCode}.json`);
  const source = "scan transcriptions in scripts/marvelcdb/curation (addedRecords); generated";
  writeFileSync(path, `${JSON.stringify({ source, pack: curation.packCode, cards: records }, null, 2)}\n`);
  console.log(`${curation.packCode}: ${records.length} records -> ${path}`);
}
