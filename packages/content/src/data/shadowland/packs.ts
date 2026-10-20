// GENERATED FILE — do not edit by hand.
// Source: Hall of Heroes preview scans, hand-transcribed as addedRecords (no MarvelCDB pack "shadowland": every record is an addedRecord transcribed from scans (curation/shadowland.ts); export: packages/content/raw/hallofheroes/shadowland.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/shadowland.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack shadowland [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const SHADOWLAND_CYCLE: Cycle = { id: cycleId("cycle11"), name: "Fear No Evil", order: 11 };

/** Release date source: Hall of Heroes (https://hallofheroeslcg.com/shadowland/, "October 16, 2026", read 2026-10-19; announced 2026-07-27 by FFG, https://www.fantasyflightgames.com/en/news/2026/7/28/creeping-corruption/, product code MC65en). MarvelCDB has no Shadowland pack yet, so the date is not cross-checked there. */
export const SHADOWLAND_PACK: Pack = {
  code: setCode("shadowland"),
  name: "Shadowland",
  cycleId: cycleId("cycle11"),
  releaseDate: "2026-10-16",
};
