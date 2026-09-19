// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gam (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gam.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gam.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gam [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const GAM_CYCLE: Cycle = { id: cycleId("cycle3"), name: "Cycle 3", order: 3 };

/** Release date source: Hall of Heroes Gamora page (https://hallofheroeslcg.com/gamora/): "Release date: May 14, 2021" */
export const GAM_PACK: Pack = { code: setCode("gam"), name: "Gamora", cycleId: cycleId("cycle3"), releaseDate: "2021-05-14" };
