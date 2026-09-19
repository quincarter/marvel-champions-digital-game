// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gambit (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gambit.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gambit.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gambit [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const GAMBIT_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Cycle 6", order: 6 };

/** Release date source: Hall of Heroes Gambit page (https://hallofheroeslcg.com/gambit-remy-lebeau/): "Release date: February 24, 2023" */
export const GAMBIT_PACK: Pack = { code: setCode("gambit"), name: "Gambit", cycleId: cycleId("cycle6"), releaseDate: "2023-02-24" };
