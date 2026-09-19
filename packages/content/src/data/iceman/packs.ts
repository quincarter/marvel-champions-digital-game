// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/iceman (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/iceman.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iceman.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iceman [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const ICEMAN_CYCLE: Cycle = { id: cycleId("cycle8"), name: "Cycle 8", order: 8 };

/** Release date source: Hall of Heroes Iceman/Bobby Drake page (https://hallofheroeslcg.com/iceman-bobby-drake/): "Release date: May 17, 2024" */
export const ICEMAN_PACK: Pack = { code: setCode("iceman"), name: "Iceman", cycleId: cycleId("cycle8"), releaseDate: "2024-05-17" };
