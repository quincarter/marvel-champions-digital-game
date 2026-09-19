/**
 * Drax Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const DRAX_CURATION: PackCuration = {
  packCode: "drax",
  cycle: { id: "cycle3", name: "Cycle 3", order: 3 },
  pack: {
    name: "Drax",
    releaseDate: "2021-06-18",
    releaseDateSource: "Hall of Heroes Drax page (https://hallofheroeslcg.com/drax-2/): \"Release date: June 18, 2021\"",
  },
  outDir: "src/data/drax",
  exportPrefix: "DRAX",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
