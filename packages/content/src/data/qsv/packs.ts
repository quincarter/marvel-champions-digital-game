// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/qsv (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/qsv.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/qsv.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack qsv [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const QSV_CYCLE: Cycle = { id: cycleId("cycle1"), name: "The Rise of Red Skull", order: 2 };

/** Release date source: Hall of Heroes Quicksilver page (https://hallofheroeslcg.com/quicksilver/): "Release date: February 5, 2021" */
export const QSV_PACK: Pack = { code: setCode("qsv"), name: "Quicksilver", cycleId: cycleId("cycle1"), releaseDate: "2021-02-05" };
