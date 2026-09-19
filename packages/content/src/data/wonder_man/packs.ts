// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wonder_man (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wonder_man.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wonder_man.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wonder_man [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const WONDER_MAN_CYCLE: Cycle = { id: cycleId("cycle10"), name: "Cycle 10", order: 10 };

/** Release date source: Hall of Heroes Simon Williams/Wonder Man page (https://hallofheroeslcg.com/simon-williams-wonder-man/): "Release date: February 20, 2026" */
export const WONDER_MAN_PACK: Pack = {
  code: setCode("wonder_man"),
  name: "Wonder Man",
  cycleId: cycleId("cycle10"),
  releaseDate: "2026-02-20",
};
