// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/aoa (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/aoa.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/aoa.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack aoa [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const AOA_CYCLE: Cycle = { id: cycleId("cycle8"), name: "Age of Apocalypse", order: 8 };

/** Release date source: UNVERIFIED: docs/phase7-wave8-sources.md release table (March 29, 2024, Age of Apocalypse MC45); not cross-checked against an FFG or Hall of Heroes page */
export const AOA_PACK: Pack = {
  code: setCode("aoa"),
  name: "Age of Apocalypse",
  cycleId: cycleId("cycle8"),
  releaseDate: "2024-03-29",
};
