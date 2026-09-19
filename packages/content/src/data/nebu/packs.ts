// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/nebu (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/nebu.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/nebu.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack nebu [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const NEBU_CYCLE: Cycle = { id: cycleId("cycle4"), name: "Cycle 4", order: 4 };

/** Release date source: Hall of Heroes Nebula page (https://hallofheroeslcg.com/nebula/): "Release date: September 17, 2021" */
export const NEBU_PACK: Pack = { code: setCode("nebu"), name: "Nebula", cycleId: cycleId("cycle4"), releaseDate: "2021-09-17" };
