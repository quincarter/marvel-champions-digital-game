// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/bkw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/bkw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/bkw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack bkw [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const BKW_CYCLE: Cycle = { id: cycleId("wave1"), name: "Wave 1", order: 1 };

/** Release date source: Hall of Heroes Black Widow page (https://hallofheroeslcg.com/natasha-romanoff-black-widow/): "Release date: June 5, 2020 (originally April 3, 2020)" */
export const BKW_PACK: Pack = { code: setCode("bkw"), name: "Black Widow", cycleId: cycleId("wave1"), releaseDate: "2020-06-05" };
