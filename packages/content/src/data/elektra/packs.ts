// GENERATED FILE — do not edit by hand.
// Source: Hall of Heroes preview scans, hand-transcribed as addedRecords (no MarvelCDB pack "elektra": every record is an addedRecord transcribed from scans (curation/elektra.ts); export: packages/content/raw/hallofheroes/elektra.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/elektra.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack elektra [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const ELEKTRA_CYCLE: Cycle = { id: cycleId("cycle11"), name: "Fear No Evil", order: 11 };

/** Release date source: FFG announcement "Killer Instinct" (https://www.fantasyflightgames.com/en/news/2026/8/13/killer-instinct/) and Hall of Heroes (https://hallofheroeslcg.com/elektra-natchios/): "November 2026", no day given (product code MC63en). The first of the month stands in for the unknown day. */
export const ELEKTRA_PACK: Pack = {
  code: setCode("elektra"),
  name: "Elektra",
  cycleId: cycleId("cycle11"),
  releaseDate: "2026-11-01",
};
