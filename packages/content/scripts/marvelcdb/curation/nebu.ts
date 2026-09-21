/**
 * Nebula Hero Pack (Cycle 4) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const NEBU_CURATION: PackCuration = {
  packCode: "nebu",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "Nebula",
    releaseDate: "2021-09-17",
    releaseDateSource:
      'Hall of Heroes Nebula page (https://hallofheroeslcg.com/nebula/): "Release date: September 17, 2021"',
  },
  outDir: "src/data/nebu",
  exportPrefix: "NEBU",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
