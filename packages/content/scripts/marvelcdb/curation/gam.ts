/**
 * Gamora Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const GAM_CURATION: PackCuration = {
  packCode: "gam",
  cycle: { id: "cycle3", name: "Cycle 3", order: 3 },
  pack: {
    name: "Gamora",
    releaseDate: "2021-05-14",
    releaseDateSource: 'Hall of Heroes Gamora page (https://hallofheroeslcg.com/gamora/): "Release date: May 14, 2021"',
  },
  outDir: "src/data/gam",
  exportPrefix: "GAM",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
