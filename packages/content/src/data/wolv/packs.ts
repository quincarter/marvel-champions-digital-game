// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wolv (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wolv.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wolv.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wolv [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const WOLV_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Cycle 6", order: 6 };

/** Release date source: Hall of Heroes Logan/Wolverine page (https://hallofheroeslcg.com/logan-wolverine/): "Release date: November 11, 2022" */
export const WOLV_PACK: Pack = { code: setCode("wolv"), name: "Wolverine", cycleId: cycleId("cycle6"), releaseDate: "2022-11-11" };
