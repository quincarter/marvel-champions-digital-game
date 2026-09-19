// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/silk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/silk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/silk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack silk [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const SILK_CYCLE: Cycle = { id: cycleId("cycle9"), name: "Cycle 9", order: 9 };

/** Release date source: Hall of Heroes Silk/Cindy Moon page (https://hallofheroeslcg.com/silk-cindy-moon/): "Release date: May 2, 2025" */
export const SILK_PACK: Pack = { code: setCode("silk"), name: "Silk", cycleId: cycleId("cycle9"), releaseDate: "2025-05-02" };
