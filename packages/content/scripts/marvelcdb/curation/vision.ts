/**
 * Vision Hero Pack (Cycle 4) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const VISION_CURATION: PackCuration = {
  packCode: "vision",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "Vision",
    releaseDate: "2022-01-14",
    releaseDateSource: "Hall of Heroes Vision page (https://hallofheroeslcg.com/vision/): \"Release date: January 14, 2022\"",
  },
  outDir: "src/data/vision",
  exportPrefix: "VISION",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
