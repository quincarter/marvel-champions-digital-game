// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/hood (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/hood.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/hood.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack hood [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const HOOD_CYCLE: Cycle = { id: cycleId("cycle4"), name: "Cycle 4", order: 4 };

/** Release date source: Hall of Heroes The Hood page (https://hallofheroeslcg.com/the-hood/): "Release date: November 26, 2021 (Expected)" */
export const HOOD_PACK: Pack = { code: setCode("hood"), name: "The Hood", cycleId: cycleId("cycle4"), releaseDate: "2021-11-26" };
