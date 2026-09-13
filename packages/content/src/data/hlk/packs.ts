// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/hlk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/hlk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/hlk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack hlk [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const HLK_CYCLE: Cycle = { id: cycleId("wave1"), name: "Wave 1", order: 1 };

/** Release date source: Hall of Heroes Hulk page (https://hallofheroeslcg.com/bruce-banner-hulk/): "Release date: August 7, 2020 (originally June, 2020)" */
export const HLK_PACK: Pack = { code: setCode("hlk"), name: "Hulk", cycleId: cycleId("wave1"), releaseDate: "2020-08-07" };
