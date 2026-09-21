/**
 * War Machine (James Rhodes) Hero Pack (Cycle 4) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const WARM_CURATION: PackCuration = {
  packCode: "warm",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "War Machine",
    releaseDate: "2021-11-12",
    releaseDateSource:
      'Hall of Heroes War Machine page (https://hallofheroeslcg.com/war-machine/): "Release date: November 12, 2021"',
  },
  outDir: "src/data/warm",
  exportPrefix: "WARM",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
