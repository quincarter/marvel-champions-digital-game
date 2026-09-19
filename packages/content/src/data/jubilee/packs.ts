// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/jubilee (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/jubilee.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/jubilee.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack jubilee [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const JUBILEE_CYCLE: Cycle = { id: cycleId("cycle8"), name: "Cycle 8", order: 8 };

/** Release date source: Hall of Heroes Jubilee/Jubilation Lee page (https://hallofheroeslcg.com/jubilee-jubilation-lee/): "Release date: July 19, 2024"; cycle grouping confirmed against Hall of Heroes' own card database navigation (https://hallofheroeslcg.com/browse/), which lists Jubilee alongside Iceman, Nightcrawler and Magneto under Cycle 8. */
export const JUBILEE_PACK: Pack = { code: setCode("jubilee"), name: "Jubilee", cycleId: cycleId("cycle8"), releaseDate: "2024-07-19" };
