// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/cyclops (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/cyclops.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/cyclops.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack cyclops [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const CYCLOPS_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Cycle 6", order: 6 };

/** Release date source: Hall of Heroes Cyclops page (https://hallofheroeslcg.com/scott-summers-cyclops/): "Release date: September 30, 2022" */
export const CYCLOPS_PACK: Pack = { code: setCode("cyclops"), name: "Cyclops", cycleId: cycleId("cycle6"), releaseDate: "2022-09-30" };
