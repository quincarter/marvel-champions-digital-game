// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ant (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ant.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ant.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ant [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const ANT_CYCLE: Cycle = { id: cycleId("cycle1"), name: "The Rise of Red Skull", order: 2 };

/** Release date source: Hall of Heroes Ant-Man page (https://hallofheroeslcg.com/ant-man/): "Release date: November 6, 2020 (Originally September, 2020)" — the wide release date is used, matching the raw cache's own pack metadata. */
export const ANT_PACK: Pack = { code: setCode("ant"), name: "Ant-Man", cycleId: cycleId("cycle1"), releaseDate: "2020-11-06" };
