/**
 * Scarlet Witch Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/scw.json`).
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N.
 *
 * Normalizes cleanly with no hand corrections: every card's stats, text and keywords come straight from
 * MarvelCDB's `real_text`/`real_traits` with nothing to fix (survey, 2026-09-18).
 *
 * **Starter deck curated from a photo**: the Scarlet Witch Deck title-card back, printed decklist
 * (https://hallofheroeslcg.com/wp-content/uploads/2021/03/scw1.jpg, linked from
 * https://hallofheroeslcg.com/scarlet-witch/), viewed directly and cross-checked item-by-item against raw
 * (scw.json) by name and quantity — every item matched exactly, no hand corrections needed. Item 23 "Slipping
 * Sanity x2" (15023) matches raw's own `quantity: 2` (FAQ, RRG 1.8 p. 61, "is it intentional that Scarlet Witch
 * has two obligation cards? A: Yes", docs/phase7-wave2.md §1.10).
 */
import type { PackCuration } from "./types.ts";

export const SCW_CURATION: PackCuration = {
  packCode: "scw",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "Scarlet Witch",
    releaseDate: "2021-03-05",
    releaseDateSource:
      'Hall of Heroes Scarlet Witch page (https://hallofheroeslcg.com/scarlet-witch/): "Release date: March 5, 2021"',
  },
  outDir: "src/data/scw",
  exportPrefix: "SCW",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "scw-justice",
      name: "Scarlet Witch (Justice) — Hero Pack starter deck",
      identityCode: "15001a",
      aspect: "justice",
      cards: {
        // Hero cards (15002-15009), each at its printed kit quantity.
        "15002": 1,
        "15003": 1,
        "15004": 4,
        "15005": 3,
        "15006": 1,
        "15007": 1,
        "15008": 3,
        "15009": 1,
        // Justice aspect cards.
        "15010": 1,
        "15011": 1,
        "15012": 3,
        "15013": 3,
        "15014": 3,
        "15015": 3,
        "15016": 2,
        "15017": 2,
        // Basic cards.
        "15018": 1,
        "15019": 3,
        "15020": 1,
        "15021": 1,
        "15022": 1,
      },
      obligationCode: "15023",
      nemesisCodes: ["15024", "15025", "15026", "15027"],
      verified: true,
      sources: [
        "Scarlet Witch Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2021/03/scw1.jpg, linked from https://hallofheroeslcg.com/scarlet-witch/)",
      ],
    },
  ],
};
