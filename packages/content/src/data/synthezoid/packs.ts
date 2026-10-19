// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/synthezoid (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/synthezoid.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/synthezoid.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack synthezoid [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const SYNTHEZOID_CYCLE: Cycle = { id: cycleId("cycle10"), name: "Civil War", order: 10 };

/** Release date source: Hall of Heroes Synthezoid Smackdown page (https://hallofheroeslcg.com/synthezoid-smackdown/), used as a pointer: "Release date: December, 2025" with no day (hallofheroes-llms.txt). The day is UNCHECKED against a primary source: a search (2026-10-18, survey section 1) returned an FFG announcement that the pack was available in select markets on 2025-11-21 and in the US on 2025-12-05 (Asmodee listing). 2025-12-05 is recorded; either date puts the pack after Civil War and before Wonder Man. The date is not printed in the MC57 rulebook. */
export const SYNTHEZOID_PACK: Pack = {
  code: setCode("synthezoid"),
  name: "Synthezoid Smackdown",
  cycleId: cycleId("cycle10"),
  releaseDate: "2025-12-05",
};
