/**
 * Star-Lord (Peter Quill) Hero Pack (Cycle 3, Guardians of the Galaxy) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Scenario data not curated** — `stld` is a hero pack with no scenario of its own (wave3 docs/phase7-wave3.md
 * §2.1). Starter deck curated wave 3 (below).
 */
import type { PackCuration } from "./types.ts";

export const STLD_CURATION: PackCuration = {
  packCode: "stld",
  cycle: { id: "cycle3", name: "The Galaxy's Most Wanted", order: 3 },
  pack: {
    name: "Star-Lord",
    releaseDate: "2021-05-14",
    releaseDateSource:
      'Hall of Heroes Star-Lord page (https://hallofheroeslcg.com/peter-quill-star-lord/): "Release date: May 14, 2021"',
  },
  outDir: "src/data/stld",
  exportPrefix: "STLD",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "star-lord-leadership",
      name: "Star-Lord (Leadership) — starter deck",
      identityCode: "17001a",
      aspect: "leadership",
      cards: {
        // Star-Lord cards (17002-17010), Hall of Heroes starter-deck image ("Star-Lord Deck"): "Nova Prime,
        // Daring Escape x3, Gutsy Move x2, Sliding Shot x3, Bad Boy, Element Gun x2, Jet Boots, Leader of the
        // Guardians, Star-Lord's Helmet". 15 hero cards.
        "17002": 1,
        "17003": 3,
        "17004": 2,
        "17005": 3,
        "17006": 1,
        "17007": 2,
        "17008": 1,
        "17009": 1,
        "17010": 1,
        // Leadership cards: "Adam Warlock, Beta Ray Bill, Yondu, Air Supremacy x3, Blaze of Glory x3, Get Ready
        // x2, Target Practice x3, The Power of Leadership x2, Laser Blaster x3". 19 aspect cards.
        "17011": 1,
        "17012": 1,
        "17013": 1,
        "17014": 3,
        "17015": 3,
        "17016": 2,
        "17017": 3,
        "17018": 2,
        "17019": 3,
        // Basic cards: "Cosmo, C.I.T.T., Knowhere, Pulse Grenade x3". 6 basic cards. 15 + 19 + 6 = 40.
        "17020": 1,
        "17021": 1,
        "17022": 1,
        "17023": 3,
      },
      obligationCode: "17024",
      nemesisCodes: ["17025", "17026", "17027"],
      verified: true,
      sources: [
        'Hall of Heroes Star-Lord release page (https://hallofheroeslcg.com/peter-quill-star-lord/), "Starter Deck" link: https://hallofheroeslcg.com/wp-content/uploads/2021/05/starlorddeck.jpg — image transcribed directly (card-data-pipeline, wave 3).',
      ],
      note: "40 cards = 15 Star-Lord + 19 Leadership + 6 Basic, matching the printed deck-list card's own counts. Nemesis set (Budding Crime Syndicate, Mister Knife, Spartoi Cunning x3) matches docs/phase7-wave3.md §2.1's independently-researched table.",
    },
  ],
};
