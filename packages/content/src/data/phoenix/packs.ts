// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/phoenix (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/phoenix.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/phoenix.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack phoenix [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const PHOENIX_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Cycle 6", order: 6 };

/** Release date source: Hall of Heroes Jean Grey/Phoenix page (https://hallofheroeslcg.com/jean-grey-phoenix/): "Release date: September 30, 2022" */
export const PHOENIX_PACK: Pack = { code: setCode("phoenix"), name: "Phoenix", cycleId: cycleId("cycle6"), releaseDate: "2022-09-30" };
