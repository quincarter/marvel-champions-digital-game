/**
 * Star-Lord (Peter Quill) Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const STLD_CURATION: PackCuration = {
  packCode: "stld",
  cycle: { id: "cycle3", name: "Cycle 3", order: 3 },
  pack: {
    name: "Star-Lord",
    releaseDate: "2021-05-14",
    releaseDateSource: "Hall of Heroes Star-Lord page (https://hallofheroeslcg.com/peter-quill-star-lord/): \"Release date: May 14, 2021\"",
  },
  outDir: "src/data/stld",
  exportPrefix: "STLD",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
