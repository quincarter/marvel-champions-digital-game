// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/angel (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/angel.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/angel.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack angel [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const ANGEL_CYCLE: Cycle = { id: cycleId("cycle7"), name: "Cycle 7", order: 7 };

/** Release date source: Hall of Heroes Angel/Warren Worthington III page (https://hallofheroeslcg.com/angel-warren-worthington-iii/): "September 22, 2023"; cycle grouping confirmed against Hall of Heroes' own card database navigation (https://hallofheroeslcg.com/browse/), which lists Angel alongside Psylocke, X-23 and Deadpool under Cycle 7. */
export const ANGEL_PACK: Pack = { code: setCode("angel"), name: "Angel", cycleId: cycleId("cycle7"), releaseDate: "2023-09-22" };
