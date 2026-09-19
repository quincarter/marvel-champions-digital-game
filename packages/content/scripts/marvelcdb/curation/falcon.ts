/**
 * Falcon (Sam Wilson) Hero Pack (Cycle 9) curation.
 *
 * Normalizes cleanly with no hand corrections needed once the `Linked (Card Title).` keyword parser fix landed
 * (see `curation/bp.ts`'s header for the full explanation).
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const FALCON_CURATION: PackCuration = {
  packCode: "falcon",
  cycle: { id: "cycle9", name: "Cycle 9", order: 9 },
  pack: {
    name: "Falcon",
    releaseDate: "2025-06-20",
    releaseDateSource: "Hall of Heroes Falcon page (https://hallofheroeslcg.com/falcon-sam-wilson/): \"Release date: June 20, 2025\"",
  },
  outDir: "src/data/falcon",
  exportPrefix: "FALCON",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
