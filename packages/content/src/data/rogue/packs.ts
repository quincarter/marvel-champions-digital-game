// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/rogue (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/rogue.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/rogue.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack rogue [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const ROGUE_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Cycle 6", order: 6 };

/** Release date source: Hall of Heroes Rogue/Anna Marie page (https://hallofheroeslcg.com/rogue-anna-marie/): "Release date: February 24, 2023" */
export const ROGUE_PACK: Pack = { code: setCode("rogue"), name: "Rogue", cycleId: cycleId("cycle6"), releaseDate: "2023-02-24" };
