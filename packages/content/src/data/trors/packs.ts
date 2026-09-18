// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/trors (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/trors.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/trors.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack trors [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const TRORS_CYCLE: Cycle = { id: cycleId("cycle1"), name: "The Rise of Red Skull", order: 2 };

/** Release date source: Hall of Heroes "The Rise of Red Skull (Encounter Cards)" page (https://hallofheroeslcg.com/the-rise-of-red-skull/): "Release date: September 4, 2020 (Originally July, 2020)" — the wide release date is used. */
export const TRORS_PACK: Pack = {
  code: setCode("trors"),
  name: "The Rise of Red Skull",
  cycleId: cycleId("cycle1"),
  releaseDate: "2020-09-04",
};
