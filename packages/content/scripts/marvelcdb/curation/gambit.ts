/**
 * Gambit (Remy LeBeau) Hero Pack (Cycle 6) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const GAMBIT_CURATION: PackCuration = {
  packCode: "gambit",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Gambit",
    releaseDate: "2023-02-24",
    releaseDateSource:
      'Hall of Heroes Gambit page (https://hallofheroeslcg.com/gambit-remy-lebeau/): "Release date: February 24, 2023"',
  },
  outDir: "src/data/gambit",
  exportPrefix: "GAMBIT",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
