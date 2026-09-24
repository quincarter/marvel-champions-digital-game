// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/stld (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/stld.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/stld.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack stld [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const STLD_CYCLE: Cycle = { id: cycleId("cycle3"), name: "The Galaxy's Most Wanted", order: 3 };

/** Release date source: Hall of Heroes Star-Lord page (https://hallofheroeslcg.com/peter-quill-star-lord/): "Release date: May 14, 2021" */
export const STLD_PACK: Pack = { code: setCode("stld"), name: "Star-Lord", cycleId: cycleId("cycle3"), releaseDate: "2021-05-14" };
