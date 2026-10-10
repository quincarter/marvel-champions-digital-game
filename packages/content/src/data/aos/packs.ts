// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/aos (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/aos.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/aos.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack aos [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const AOS_CYCLE: Cycle = { id: cycleId("cycle9"), name: "Agents of S.H.I.E.L.D.", order: 9 };

/** Release date source: Hall of Heroes Agents of S.H.I.E.L.D. page (https://hallofheroeslcg.com/agents-of-shield/): "Release date: March 7, 2025" */
export const AOS_PACK: Pack = {
  code: setCode("aos"),
  name: "Agents of S.H.I.E.L.D.",
  cycleId: cycleId("cycle9"),
  releaseDate: "2025-03-07",
};
