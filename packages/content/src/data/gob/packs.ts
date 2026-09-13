// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gob (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gob.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gob.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gob [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const GOB_CYCLE: Cycle = { id: cycleId("wave1"), name: "Wave 1", order: 1 };

/** Release date source: Hall of Heroes Green Goblin page (https://hallofheroeslcg.com/green-goblin/): "Release date: December 20, 2019" */
export const GOB_PACK: Pack = { code: setCode("gob"), name: "Green Goblin", cycleId: cycleId("wave1"), releaseDate: "2019-12-20" };
