// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/nova (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/nova.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/nova.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack nova [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const NOVA_CYCLE: Cycle = { id: cycleId("cycle5"), name: "Cycle 5", order: 5 };

/** Release date source: Hall of Heroes Sam Alexander/Nova page (https://hallofheroeslcg.com/sam-alexander-nova/): "Release date: May 20, 2022" */
export const NOVA_PACK: Pack = { code: setCode("nova"), name: "Nova", cycleId: cycleId("cycle5"), releaseDate: "2022-05-20" };
