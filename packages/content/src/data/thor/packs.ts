// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/thor (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/thor.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/thor.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack thor [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const THOR_CYCLE: Cycle = { id: cycleId("wave1"), name: "Wave 1", order: 1 };

/** Release date source: Hall of Heroes Thor page (https://hallofheroeslcg.com/thor/): "Release date: March 6, 2020" */
export const THOR_PACK: Pack = { code: setCode("thor"), name: "Thor", cycleId: cycleId("wave1"), releaseDate: "2020-03-06" };
