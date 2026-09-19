// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ncrawler (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ncrawler.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ncrawler.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ncrawler [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const NCRAWLER_CYCLE: Cycle = { id: cycleId("cycle8"), name: "Cycle 8", order: 8 };

/** Release date source: Hall of Heroes Nightcrawler page (https://hallofheroeslcg.com/nightcrawler-kurt-wagner/): "Release date: September 20, 2024" */
export const NCRAWLER_PACK: Pack = {
  code: setCode("ncrawler"),
  name: "Nightcrawler",
  cycleId: cycleId("cycle8"),
  releaseDate: "2024-09-20",
};
