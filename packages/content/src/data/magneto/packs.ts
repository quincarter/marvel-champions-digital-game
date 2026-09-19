// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/magneto (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/magneto.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/magneto.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack magneto [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const MAGNETO_CYCLE: Cycle = { id: cycleId("cycle8"), name: "Cycle 8", order: 8 };

/** Release date source: Hall of Heroes Magneto page (https://hallofheroeslcg.com/magneto-erik-lehnsherr/): "Release date: November 15, 2024" */
export const MAGNETO_PACK: Pack = { code: setCode("magneto"), name: "Magneto", cycleId: cycleId("cycle8"), releaseDate: "2024-11-15" };
