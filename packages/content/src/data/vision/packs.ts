// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/vision (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/vision.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/vision.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack vision [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const VISION_CYCLE: Cycle = { id: cycleId("cycle4"), name: "Cycle 4", order: 4 };

/** Release date source: Hall of Heroes Vision page (https://hallofheroeslcg.com/vision/): "Release date: January 14, 2022" */
export const VISION_PACK: Pack = { code: setCode("vision"), name: "Vision", cycleId: cycleId("cycle4"), releaseDate: "2022-01-14" };
