/**
 * Magneto (Erik Lehnsherr) Hero Pack (Cycle 8) curation.
 *
 * Normalizes cleanly with no hand corrections needed once the `Linked (Card Title).` keyword parser fix landed
 * (`parse-text.ts`, `normalize/player-cards.ts` — see `curation/bp.ts`'s header for the full explanation).
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const MAGNETO_CURATION: PackCuration = {
  packCode: "magneto",
  cycle: { id: "cycle8", name: "Cycle 8", order: 8 },
  pack: {
    name: "Magneto",
    releaseDate: "2024-11-15",
    releaseDateSource: "Hall of Heroes Magneto page (https://hallofheroeslcg.com/magneto-erik-lehnsherr/): \"Release date: November 15, 2024\"",
  },
  outDir: "src/data/magneto",
  exportPrefix: "MAGNETO",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
