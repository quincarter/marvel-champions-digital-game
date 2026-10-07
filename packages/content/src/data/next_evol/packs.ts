// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/next_evol (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/next_evol.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/next_evol.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack next_evol [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const NEXT_EVOL_CYCLE: Cycle = { id: cycleId("cycle7"), name: "NeXt Evolution", order: 7 };

/** Release date source: docs/phase7-wave7-sources.md release table (August 18, 2023; Hall of Heroes https://hallofheroeslcg.com/next-evolution/) */
export const NEXT_EVOL_PACK: Pack = {
  code: setCode("next_evol"),
  name: "NeXt Evolution",
  cycleId: cycleId("cycle7"),
  releaseDate: "2023-08-18",
};
