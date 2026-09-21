/**
 * Nightcrawler (Kurt Wagner) Hero Pack (Cycle 8) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const NCRAWLER_CURATION: PackCuration = {
  packCode: "ncrawler",
  cycle: { id: "cycle8", name: "Cycle 8", order: 8 },
  pack: {
    name: "Nightcrawler",
    releaseDate: "2024-09-20",
    releaseDateSource:
      'Hall of Heroes Nightcrawler page (https://hallofheroeslcg.com/nightcrawler-kurt-wagner/): "Release date: September 20, 2024"',
  },
  outDir: "src/data/ncrawler",
  exportPrefix: "NCRAWLER",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
