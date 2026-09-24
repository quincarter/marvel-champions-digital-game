/**
 * Venom (Flash Thompson) Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Scenario data not curated** — `vnm` is a hero pack with no scenario of its own. Starter deck curated wave 3
 * (below).
 */
import type { PackCuration } from "./types.ts";

export const VNM_CURATION: PackCuration = {
  packCode: "vnm",
  cycle: { id: "cycle3", name: "The Galaxy's Most Wanted", order: 3 },
  pack: {
    name: "Venom",
    releaseDate: "2021-07-16",
    releaseDateSource: 'Hall of Heroes Venom page (https://hallofheroeslcg.com/venom/): "Release date: July 16, 2021"',
  },
  outDir: "src/data/vnm",
  exportPrefix: "VNM",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "venom-justice",
      name: "Venom (Justice) — starter deck",
      identityCode: "20001a",
      aspect: "justice",
      cards: {
        // Venom cards (20002-20010), Hall of Heroes starter-deck image ("Venom Deck"): "Behind Enemy Lines x2,
        // Grasping Tendrils x2, Locked and Loaded, Run and Gun x3, Savage Attack x2, Project Rebirth 2.0,
        // Multi-Gun, Spider-Sense, Venom's Pistol x2". 15 hero cards.
        "20002": 2,
        "20003": 2,
        "20004": 1,
        "20005": 3,
        "20006": 2,
        "20007": 1,
        "20008": 1,
        "20009": 1,
        "20010": 2,
        // Justice cards: "Jack Flag, Scare Tactic x3, Making an Entrance x3, The Power of Justice x2, Sonic
        // Rifle x3". 12 aspect cards.
        "20011": 1,
        "20012": 3,
        "20013": 3,
        "20014": 2,
        "20015": 3,
        // Basic cards: "Star-Lord, Energy, Genius, Strength, Resourceful x3, Side Holster x3, Plasma Pistol x3".
        // 13 basic cards. 15 + 12 + 13 = 40.
        "20016": 1,
        "20017": 1,
        "20018": 1,
        "20019": 1,
        "20020": 3,
        "20021": 3,
        "20022": 3,
      },
      obligationCode: "20023",
      nemesisCodes: ["20024", "20025"],
      verified: true,
      sources: [
        'Hall of Heroes Venom release page (https://hallofheroeslcg.com/venom/), "Starter Deck" link: https://hallofheroeslcg.com/wp-content/uploads/2021/07/starterdeck.jpg — image transcribed directly (card-data-pipeline, wave 3).',
      ],
      note: "40 cards = 15 Venom + 12 Justice + 13 Basic, matching the printed deck-list card's own counts. Nemesis set (Klyntar Frenzy, Enraged Symbiote x4) matches docs/phase7-wave3.md §2.1's independently-researched table.",
    },
  ],
};
