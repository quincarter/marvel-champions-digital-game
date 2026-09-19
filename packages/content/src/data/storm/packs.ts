// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/storm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/storm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/storm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack storm [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const STORM_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Cycle 6", order: 6 };

/** Release date source: Hall of Heroes Ororo Munroe/Storm page (https://hallofheroeslcg.com/ororo-munroe-storm/): "Release date: November 11, 2022" */
export const STORM_PACK: Pack = { code: setCode("storm"), name: "Storm", cycleId: cycleId("cycle6"), releaseDate: "2022-11-11" };
