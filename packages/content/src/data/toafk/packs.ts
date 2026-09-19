// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/toafk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/toafk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/toafk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack toafk [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const TOAFK_CYCLE: Cycle = { id: cycleId("cycle1"), name: "The Rise of Red Skull", order: 2 };

/** Release date source: Hall of Heroes The Once and Future Kang page (https://hallofheroeslcg.com/the-once-and-future-kang/): "Release date: October 2, 2020 (Originally August, 2020)" — the wide release date is used. */
export const TOAFK_PACK: Pack = {
  code: setCode("toafk"),
  name: "The Once and Future Kang",
  cycleId: cycleId("cycle1"),
  releaseDate: "2020-10-02",
};
