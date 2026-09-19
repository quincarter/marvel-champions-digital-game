// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/warm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/warm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/warm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack warm [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const WARM_CYCLE: Cycle = { id: cycleId("cycle4"), name: "Cycle 4", order: 4 };

/** Release date source: Hall of Heroes War Machine page (https://hallofheroeslcg.com/war-machine/): "Release date: November 12, 2021" */
export const WARM_PACK: Pack = {
  code: setCode("warm"),
  name: "War Machine",
  cycleId: cycleId("cycle4"),
  releaseDate: "2021-11-12",
};
