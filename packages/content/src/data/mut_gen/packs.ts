// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mut_gen (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mut_gen.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mut_gen.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mut_gen [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const MUT_GEN_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Mutant Genesis", order: 6 };

/** Release date source: docs/phase7-wave6-sources.md release table (September 30, 2022; Hall of Heroes https://hallofheroeslcg.com/mutant-genesis/) */
export const MUT_GEN_PACK: Pack = {
  code: setCode("mut_gen"),
  name: "Mutant Genesis",
  cycleId: cycleId("cycle6"),
  releaseDate: "2022-09-30",
};
