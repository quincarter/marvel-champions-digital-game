// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/bp (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/bp.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/bp.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack bp [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const BP_CYCLE: Cycle = { id: cycleId("cycle9"), name: "Cycle 9", order: 9 };

/** Release date source: Hall of Heroes Black Panther/Shuri page (https://hallofheroeslcg.com/black-panther-shuri/): "Release date: May 2, 2025" */
export const BP_PACK: Pack = {
  code: setCode("bp"),
  name: "Black Panther/Shuri",
  cycleId: cycleId("cycle9"),
  releaseDate: "2025-05-02",
};
