/**
 * Ant-Man Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/ant.json`).
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N.
 *
 * Normalizes cleanly with no hand corrections (survey, 2026-09-18), once the schema/parser support docs/
 * phase7-wave2.md §1.1 landed: Scott Lang/Ant-Man's Giant inside face (12001c) folds into `additionalHeroForms`
 * instead of erroring as an unlinked hero record.
 *
 * **Starter deck curated from a photo**, following wave 1's provenance discipline (`curation/cap.ts` et al.):
 * the Ant-Man Deck title-card back, printed decklist
 * (https://hallofheroeslcg.com/wp-content/uploads/2020/11/antmanstarterdeck.jpg, linked from
 * https://hallofheroeslcg.com/ant-man/), viewed directly and cross-checked item-by-item against raw (ant.json) by
 * name and quantity — every item matched exactly, no hand corrections needed.
 */
import type { PackCuration } from "./types.ts";

export const ANT_CURATION: PackCuration = {
  packCode: "ant",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "Ant-Man",
    releaseDate: "2020-11-06",
    releaseDateSource:
      'Hall of Heroes Ant-Man page (https://hallofheroeslcg.com/ant-man/): "Release date: November 6, 2020 (Originally September, 2020)" — the wide release date is used, matching the raw cache\'s own pack metadata.',
  },
  outDir: "src/data/ant",
  exportPrefix: "ANT",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "ant-leadership",
      name: "Ant-Man (Leadership) — Hero Pack starter deck",
      identityCode: "12001a",
      aspect: "leadership",
      cards: {
        // Hero cards (12002-12010), each at its printed kit quantity.
        "12002": 1,
        "12003": 2,
        "12004": 1,
        "12005": 2,
        "12006": 2,
        "12007": 3,
        "12008": 1,
        "12009": 2,
        "12010": 1,
        // Leadership aspect cards.
        "12011": 1,
        "12012": 1,
        "12013": 1,
        "12014": 1,
        "12015": 3,
        "12016": 3,
        "12017": 3,
        "12018": 3,
        // Basic cards.
        "12019": 2,
        "12020": 1,
        "12021": 1,
        "12022": 1,
        "12023": 1,
        "12024": 3,
      },
      obligationCode: "12025",
      nemesisCodes: ["12026", "12027", "12028", "12029"],
      verified: true,
      sources: [
        "Ant-Man Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/11/antmanstarterdeck.jpg, linked from https://hallofheroeslcg.com/ant-man/)",
      ],
    },
  ],
};
