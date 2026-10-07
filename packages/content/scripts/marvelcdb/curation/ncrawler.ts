/**
 * Nightcrawler (Kurt Wagner) Hero Pack (Cycle 8) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Scenario data not curated this pass** — data-only pool (PLAN.md Phase 7). The Protection starter deck comes from the pack's printed decklist card.
 */
import type { PackCuration } from "./types.ts";

export const NCRAWLER_CURATION: PackCuration = {
  packCode: "ncrawler",
  cycle: { id: "cycle8", name: "Age of Apocalypse", order: 8 },
  pack: {
    name: "Nightcrawler",
    releaseDate: "2024-09-20",
    releaseDateSource:
      'Hall of Heroes Nightcrawler page (https://hallofheroeslcg.com/nightcrawler-kurt-wagner/): "Release date: September 20, 2024"',
  },
  outDir: "src/data/ncrawler",
  exportPrefix: "NCRAWLER",

  corrections: [],
  errata: [
    {
      code: "48012",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Rogue: "printed THW and ATK" is now "base THW and ATK". MarvelCDB (and the scan) carry the printed wording.',
      evidence:
        'RRG 1.8 p. 69, Nightcrawler Hero Pack ROGUE (#12) errata; scan 48012.jpg read, prints "printed THW and ATK"',
      currentReplace: {
        find: "adds that character's printed THW and ATK",
        replace: "adds that character's base THW and ATK",
      },
    },
    {
      code: "48037",
      version: "RRG 1.8",
      changedFields: ["boostIcons"],
      note: "Tweedledope: the star icon was removed from the boost field. The printed card shows the star; current data has none (MarvelCDB boost_star false, no Boost ability). Text is unchanged.",
      evidence:
        "RRG 1.8 p. 69, Nightcrawler Hero Pack TWEEDLEDOPE (#37) errata; scan 48037.jpg read, prints the star bottom right",
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "48004":
      'Kurt\'s Cutlasses prints "Counts as 2 restricted cards." (scan 48004.png read). Emitted as `restrictedWeight: 2` with one constant ability for the stat bonus, the Laser Swords model (`deadpool` 44055; docs/phase7-wave8.md §3.73).',
  },

  scenarios: [],
  starterDecks: [
    {
      id: "nightcrawler-protection",
      name: "Nightcrawler (Protection) — Nightcrawler Hero Pack starter deck",
      identityCode: "48001a",
      aspect: "protection",
      cards: {
        "48002": 1, // Daytripper
        "48003": 1, // Kurt's Chapel
        "48004": 1, // Kurt's Cutlasses
        "48005": 1, // Prehensile Tail
        "48006": 3, // Bamf!
        "48007": 2, // 'Port and Punch
        "48008": 1, // Teleport Drop
        "48009": 2, // Scout Ahead
        "48010": 1, // 'Port Away
        "48011": 2, // Tally Ho!
        "48012": 1, // Rogue
        "48013": 1, // Northstar
        "48014": 3, // Change of Fortune
        "48015": 3, // Under Control
        "48016": 3, // "Come Get Me, Bub!"
        "48017": 3, // Powerful Punch
        "48018": 3, // Riposte
        "48019": 2, // The Power of Protection
        "48020": 1, // Astonishing X-Men (Protection player side scheme)
        "48021": 1, // Gambit
        "48022": 1, // Moira MacTaggert
        "48023": 1, // Energy
        "48024": 1, // Genius
        "48025": 1, // Strength
      },
      obligationCode: "48026",
      nemesisCodes: ["48027", "48028", "48029", "48030"],
      verified: true,
      sources: [
        'Nightcrawler Hero Pack printed decklist card, "Nightcrawler Deck" (the owner\'s photo of the card, 2026-10-07), transcribed in docs/phase7-wave8-handoff.md',
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Nightcrawler, 20 Protection (Astonishing X-Men is the in-aspect player side scheme), 5 basic. Identity is 48001a. The printed card numbers equal the codes' last digits; every title and quantity matches raw/marvelcdb/ncrawler.json (checked by script).",
    },
  ],
};
