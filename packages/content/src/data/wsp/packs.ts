// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wsp (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wsp.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wsp.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wsp [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const WSP_CYCLE: Cycle = { id: cycleId("cycle1"), name: "The Rise of Red Skull", order: 2 };

/** Release date source: Hall of Heroes Wasp page (https://hallofheroeslcg.com/wasp/): "Release date: January 22, 2021" */
export const WSP_PACK: Pack = { code: setCode("wsp"), name: "Wasp", cycleId: cycleId("cycle1"), releaseDate: "2021-01-22" };
