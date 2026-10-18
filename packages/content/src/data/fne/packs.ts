// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/fne (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/fne.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/fne.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack fne [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const FNE_CYCLE: Cycle = { id: cycleId("cycle11"), name: "Fear No Evil", order: 11 };

/** Release date source: MarvelCDB pack list (https://marvelcdb.com/api/public/packs/, code fne, "available": "2026-07-24", read 2026-10-18); the same day MarvelCDB's Echo precon decklist 63934 was posted. Replaces the Hall of Heroes page's month-only "July, 2026". */
export const FNE_PACK: Pack = {
  code: setCode("fne"),
  name: "Fear No Evil",
  cycleId: cycleId("cycle11"),
  releaseDate: "2026-07-24",
};
