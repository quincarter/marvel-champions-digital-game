// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/core (fetched 2026-09-12; raw cache: packages/content/raw/marvelcdb/core.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/core.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack core [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const CORE_CYCLE: Cycle = { id: cycleId("core"), name: "Core Set", order: 0 };

/** Release date source: Hall of Heroes Core Set page (https://hallofheroeslcg.com/core-set-2/) */
export const CORE_PACK: Pack = { code: setCode("core"), name: "Core Set", cycleId: cycleId("core"), releaseDate: "2019-11-01" };
