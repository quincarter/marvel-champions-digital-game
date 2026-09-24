// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/vnm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/vnm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/vnm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack vnm [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const VNM_CYCLE: Cycle = { id: cycleId("cycle3"), name: "The Galaxy's Most Wanted", order: 3 };

/** Release date source: Hall of Heroes Venom page (https://hallofheroeslcg.com/venom/): "Release date: July 16, 2021" */
export const VNM_PACK: Pack = { code: setCode("vnm"), name: "Venom", cycleId: cycleId("cycle3"), releaseDate: "2021-07-16" };
