/**
 * Drax Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Scenario data not curated** — `drax` is a hero pack with no scenario of its own. Starter deck curated wave 3
 * (below).
 */
import type { PackCuration } from "./types.ts";

export const DRAX_CURATION: PackCuration = {
  packCode: "drax",
  cycle: { id: "cycle3", name: "The Galaxy's Most Wanted", order: 3 },
  pack: {
    name: "Drax",
    releaseDate: "2021-06-18",
    releaseDateSource: 'Hall of Heroes Drax page (https://hallofheroeslcg.com/drax-2/): "Release date: June 18, 2021"',
  },
  outDir: "src/data/drax",
  exportPrefix: "DRAX",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "drax-protection",
      name: "Drax (Protection) — starter deck",
      identityCode: "19001a",
      aspect: "protection",
      cards: {
        // Drax cards (19002-19011), Hall of Heroes starter-deck image ("Drax Deck"): "Mantis, \"Fight Me,
        // Coward!\" x2, Intimidation x2, Knife Leap x2, Parry x2, Payback x2, Drax's Knife, Drax's Other Knife,
        // DWI Theet Mastery, Too Stubborn to Die". 15 hero cards.
        "19002": 1,
        "19003": 2,
        "19004": 2,
        "19005": 2,
        "19006": 2,
        "19007": 2,
        "19008": 1,
        "19009": 1,
        "19010": 1,
        "19011": 1,
        // Protection cards: "Martyr, Moondragon, Counter-punch x2, Deflection x3, Hard Knocks x3, Leading Blow
        // x3, Subdue x3, Indomitable x2". 18 aspect cards.
        "19012": 1,
        "19013": 1,
        "19014": 2,
        "19015": 3,
        "19016": 3,
        "19017": 3,
        "19018": 3,
        "19019": 2,
        // Basic cards: "Gamora, Athletic Conditioning x3, Energy, Genius, Strength". 7 basic cards. 15+18+7=40.
        "19020": 1,
        "19021": 3,
        "19022": 1,
        "19023": 1,
        "19024": 1,
      },
      obligationCode: "19025",
      nemesisCodes: ["19026", "19027", "19028", "19029"],
      verified: true,
      sources: [
        'Hall of Heroes Drax release page (https://hallofheroeslcg.com/drax-2/), "Starter Deck" link: https://hallofheroeslcg.com/wp-content/uploads/2021/06/drax.jpg — image transcribed directly (card-data-pipeline, wave 3).',
      ],
      note: "40 cards = 15 Drax + 18 Protection + 7 Basic, matching the printed deck-list card's own counts. Nemesis set (Cull the Weak, Yotat the Destroyer, Challenge Accepted, \"I Will Destroy You!\" x2) matches docs/phase7-wave3.md §2.1's independently-researched table.",
    },
  ],
};
