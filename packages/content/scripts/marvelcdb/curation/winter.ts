/**
 * Winter Soldier (Bucky Barnes) Hero Pack (Cycle 9) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const WINTER_CURATION: PackCuration = {
  packCode: "winter",
  cycle: { id: "cycle9", name: "Cycle 9", order: 9 },
  pack: {
    name: "Winter Soldier",
    releaseDate: "2025-06-20",
    releaseDateSource: "Hall of Heroes Winter Soldier page (https://hallofheroeslcg.com/winter-soldier-bucky-barnes/): \"Release date: June 20, 2025\"",
  },
  outDir: "src/data/winter",
  exportPrefix: "WINTER",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
