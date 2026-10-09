// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/tt (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/tt.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/tt.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack tt [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const TT_CYCLE: Cycle = { id: cycleId("cycle9"), name: "Agents of S.H.I.E.L.D.", order: 9 };

/** Release date source: Hall of Heroes Trickster Takeover page (https://hallofheroeslcg.com/trickster-takeover/), used as a pointer; the date is not stated in the MC55 insert. UNVERIFIED against a primary FFG source. */
export const TT_PACK: Pack = {
  code: setCode("tt"),
  name: "Trickster Takeover",
  cycleId: cycleId("cycle9"),
  releaseDate: "2025-08-15",
};
