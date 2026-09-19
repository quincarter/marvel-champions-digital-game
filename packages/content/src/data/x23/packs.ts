// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/x23 (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/x23.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/x23.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack x23 [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const X23_CYCLE: Cycle = { id: cycleId("cycle7"), name: "Cycle 7", order: 7 };

/** Release date source: Hall of Heroes X-23/Laura Kinney page (https://hallofheroeslcg.com/x-23-laura-kinney/): "Release date: November 17, 2023" */
export const X23_PACK: Pack = { code: setCode("x23"), name: "X-23", cycleId: cycleId("cycle7"), releaseDate: "2023-11-17" };
