/**
 * Silk (Cindy Moon) Hero Pack curation. Cycle 9 per the Hall of Heroes card database navigation
 * (https://hallofheroeslcg.com/browse/): Black Panther/Shuri, Silk, Falcon, Winter Soldier, Trickster Takeover.
 *
 * Normalizes cleanly with no hand corrections needed once the Requirement multi-icon parser fix (wave 2 schema
 * pass §6.1, docs/phase7-wave2.md) landed.
 */
import type { PackCuration } from "./types.ts";

export const SILK_CURATION: PackCuration = {
  packCode: "silk",
  cycle: { id: "cycle9", name: "Agents of S.H.I.E.L.D.", order: 9 },
  pack: {
    name: "Silk",
    releaseDate: "2025-05-02",
    releaseDateSource:
      'Hall of Heroes Silk/Cindy Moon page (https://hallofheroeslcg.com/silk-cindy-moon/): "Release date: May 2, 2025"',
  },
  outDir: "src/data/silk",
  exportPrefix: "SILK",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "silk-protection",
      name: "Silk (Protection) — Silk Hero Pack starter deck",
      identityCode: "52001a",
      aspect: "protection",
      cards: {
        "52002": 2, // Smooth as Silk
        "52003": 3, // Swinging Silk Kick
        "52004": 2, // Wallcrawl
        "52005": 1, // Get the Scoop
        "52006": 1, // Albert Moon
        "52007": 1, // J. Jonah Jameson
        "52008": 1, // Eidetic Memory
        "52009": 1, // Organic Webbing
        "52010": 1, // Outwit
        "52011": 1, // Spider Claws
        "52012": 1, // Spider Reflexes
        "52013": 1, // Scarlet Spider
        "52014": 1, // Spider-Byte
        "52015": 3, // Not Today!
        "52016": 3, // "Stop Hitting Yourself"
        "52017": 1, // Dr. Sinclair
        "52018": 3, // Energy Shield
        "52019": 3, // Ready for a Fight
        "52020": 3, // Stun Gun
        "52021": 1, // Madame Web
        "52022": 1, // Spider-Man
        "52023": 1, // Across the Spider-Verse
        "52024": 1, // Investigative Journalism
        "52025": 1, // Energy
        "52026": 1, // Genius
        "52027": 1, // Strength
      },
      obligationCode: "52028",
      nemesisCodes: ["52029", "52030", "52031"],
      verified: true,
      sources: [
        'Hall of Heroes "Starter Deck" decklist card image for this pack (wp-content/uploads/2026/01), read card by card and transcribed in docs/phase7-wave9-data-survey.md section 6.2',
      ],
      note: "40 cards by script: 15 Silk hero cards, the protection aspect cards and basic cards from the printed decklist (identity, obligation and nemesis set excluded). Printed card numbers equal the codes' last digits. Copies come from raw/marvelcdb/silk.json quantities except where the deck prints fewer than the pack contains.",
    },
  ],
};
