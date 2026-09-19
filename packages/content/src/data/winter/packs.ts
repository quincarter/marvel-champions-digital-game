// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/winter (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/winter.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/winter.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack winter [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const WINTER_CYCLE: Cycle = { id: cycleId("cycle9"), name: "Cycle 9", order: 9 };

/** Release date source: Hall of Heroes Winter Soldier page (https://hallofheroeslcg.com/winter-soldier-bucky-barnes/): "Release date: June 20, 2025" */
export const WINTER_PACK: Pack = {
  code: setCode("winter"),
  name: "Winter Soldier",
  cycleId: cycleId("cycle9"),
  releaseDate: "2025-06-20",
};
