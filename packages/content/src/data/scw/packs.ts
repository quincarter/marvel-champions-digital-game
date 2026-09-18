// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/scw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/scw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/scw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack scw [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const SCW_CYCLE: Cycle = { id: cycleId("cycle1"), name: "The Rise of Red Skull", order: 2 };

/** Release date source: Hall of Heroes Scarlet Witch page (https://hallofheroeslcg.com/scarlet-witch/): "Release date: March 5, 2021" */
export const SCW_PACK: Pack = {
  code: setCode("scw"),
  name: "Scarlet Witch",
  cycleId: cycleId("cycle1"),
  releaseDate: "2021-03-05",
};
