// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/falcon (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/falcon.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/falcon.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack falcon [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const FALCON_CYCLE: Cycle = { id: cycleId("cycle9"), name: "Cycle 9", order: 9 };

/** Release date source: Hall of Heroes Falcon page (https://hallofheroeslcg.com/falcon-sam-wilson/): "Release date: June 20, 2025" */
export const FALCON_PACK: Pack = { code: setCode("falcon"), name: "Falcon", cycleId: cycleId("cycle9"), releaseDate: "2025-06-20" };
