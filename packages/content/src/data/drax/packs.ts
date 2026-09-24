// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/drax (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/drax.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/drax.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack drax [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const DRAX_CYCLE: Cycle = { id: cycleId("cycle3"), name: "The Galaxy's Most Wanted", order: 3 };

/** Release date source: Hall of Heroes Drax page (https://hallofheroeslcg.com/drax-2/): "Release date: June 18, 2021" */
export const DRAX_PACK: Pack = { code: setCode("drax"), name: "Drax", cycleId: cycleId("cycle3"), releaseDate: "2021-06-18" };
