// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/msm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/msm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/msm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack msm [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const MSM_CYCLE: Cycle = { id: cycleId("wave1"), name: "Wave 1", order: 1 };

/** Release date source: Hall of Heroes Ms. Marvel page (https://hallofheroeslcg.com/ms-marvel/): "Release date: December 20, 2019" */
export const MSM_PACK: Pack = { code: setCode("msm"), name: "Ms. Marvel", cycleId: cycleId("wave1"), releaseDate: "2019-12-20" };
