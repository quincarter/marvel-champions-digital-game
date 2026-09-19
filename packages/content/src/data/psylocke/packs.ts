// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/psylocke (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/psylocke.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/psylocke.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack psylocke [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const PSYLOCKE_CYCLE: Cycle = { id: cycleId("cycle7"), name: "Cycle 7", order: 7 };

/** Release date source: Hall of Heroes Psylocke/Betsy Braddock page (https://hallofheroeslcg.com/psylocke-betsy-braddock/): "Release date: September 22, 2023" */
export const PSYLOCKE_PACK: Pack = {
  code: setCode("psylocke"),
  name: "Psylocke",
  cycleId: cycleId("cycle7"),
  releaseDate: "2023-09-22",
};
