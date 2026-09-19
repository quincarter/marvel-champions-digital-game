/**
 * Venom (Flash Thompson) Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const VNM_CURATION: PackCuration = {
  packCode: "vnm",
  cycle: { id: "cycle3", name: "Cycle 3", order: 3 },
  pack: {
    name: "Venom",
    releaseDate: "2021-07-16",
    releaseDateSource: "Hall of Heroes Venom page (https://hallofheroeslcg.com/venom/): \"Release date: July 16, 2021\"",
  },
  outDir: "src/data/vnm",
  exportPrefix: "VNM",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
