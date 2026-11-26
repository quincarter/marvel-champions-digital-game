// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/elektra (fetched 2026-11-25; raw cache: packages/content/raw/marvelcdb/elektra.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/elektra.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack elektra [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const ELEKTRA_CYCLE: Cycle = { id: cycleId("cycle11"), name: "Fear No Evil", order: 11 };

/** Release date source: Hall of Heroes Elektra Natchios page (https://hallofheroeslcg.com/elektra-natchios/): "Release date: November 13, 2026" (product code MC63en); FFG gives only "November 2026". */
export const ELEKTRA_PACK: Pack = {
  code: setCode("elektra"),
  name: "Elektra",
  cycleId: cycleId("cycle11"),
  releaseDate: "2026-11-13",
};
