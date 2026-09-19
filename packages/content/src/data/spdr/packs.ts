// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/spdr (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/spdr.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/spdr.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack spdr [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const SPDR_CYCLE: Cycle = { id: cycleId("cycle5"), name: "Cycle 5", order: 5 };

/** Release date source: Hall of Heroes Peni Parker/SP//dr page (https://hallofheroeslcg.com/peni-parker-sp-dr/): "Release date: July 15, 2022" */
export const SPDR_PACK: Pack = { code: setCode("spdr"), name: "SP//dr", cycleId: cycleId("cycle5"), releaseDate: "2022-07-15" };
