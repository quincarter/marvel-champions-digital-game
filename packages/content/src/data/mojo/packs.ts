// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mojo (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mojo.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mojo.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mojo [--offline]

import { cycleId, setCode } from "../../schema/index.js";
import type { Cycle, Pack } from "../../schema/index.js";

export const MOJO_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Cycle 6", order: 6 };

/** Release date source: Hall of Heroes Mojo Mania page (https://hallofheroeslcg.com/mojo-mania/): "Release date: November 11, 2022" */
export const MOJO_PACK: Pack = { code: setCode("mojo"), name: "MojoMania", cycleId: cycleId("cycle6"), releaseDate: "2022-11-11" };
