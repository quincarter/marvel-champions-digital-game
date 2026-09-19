// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/valk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/valk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/valk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack valk [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const VALK_CYCLE: Cycle = { id: cycleId("cycle4"), name: "Cycle 4", order: 4 };

/** Release date source: Hall of Heroes Brunnhilde/Valkyrie page (https://hallofheroeslcg.com/brunnhilde-valkyrie/): "Release date: January 21, 2022" */
export const VALK_PACK: Pack = { code: setCode("valk"), name: "Valkyrie", cycleId: cycleId("cycle4"), releaseDate: "2022-01-21" };
