// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ron (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ron.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ron.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ron [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const RON_CYCLE: Cycle = { id: cycleId("promo"), name: "Print and Play / Promotional", order: 0 };

/** Release date source: Hall of Heroes Ronan the Accuser page (https://hallofheroeslcg.com/ronan-the-accuser/): "Release date: August 2, 2020 (Gen Con Online)" */
export const RON_PACK: Pack = {
  code: setCode("ron"),
  name: "Ronan the Accuser Print and Play Modular Set",
  cycleId: cycleId("promo"),
  releaseDate: "2020-08-02",
};
