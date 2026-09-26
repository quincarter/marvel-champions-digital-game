/**
 * Vision Hero Pack (Cycle 4) curation.
 *
 * Normalizes cleanly with no hand corrections needed. RRG 1.8 p. 67's Machine Man (#22) errata ("Added 'for this
 * use'") is already reflected in MarvelCDB's cached text (raw `errata` note confirms it), so no curated `Errata`
 * entry was needed.
 *
 * Starter deck curated wave 4 (below) — 41 cards, not 40 (every other wave 4 hero pack's precon is exactly 40):
 * the pack's own printed starter-deck reference card lists 41 cards' worth of quantities, independently confirmed
 * by MarvelCDB's community "Vision - Precon" decklist (https://marvelcdb.com/decklist/view/16198/vision-precon-1.0,
 * `slots` sum to 41) even though FFG's own marketing copy for the pack rounds this down to "a 40-card precon deck".
 * Still legal (RRG 1.8 Appendix I: 40-50 cards).
 */
import type { PackCuration } from "./types.ts";

export const VISION_CURATION: PackCuration = {
  packCode: "vision",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "Vision",
    releaseDate: "2022-01-14",
    releaseDateSource:
      'Hall of Heroes Vision page (https://hallofheroeslcg.com/vision/): "Release date: January 14, 2022"',
  },
  outDir: "src/data/vision",
  exportPrefix: "VISION",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "vision-protection",
      name: "Vision (Protection) — starter deck",
      identityCode: "26001a",
      aspect: "protection",
      cards: {
        // Vision cards (26002-26012), Hall of Heroes starter-deck image ("Vision Deck"): "Dense / Intangible,
        // Vivian, 616 Hickory Branch Lane, Solar Gem, Vision's Cape, Density Control x2, Solar Beam x3, Superdense
        // Strike x2, Just Passing Through x2, Phase Disruption, Mass Increase". 16 hero cards.
        "26002": 1,
        "26003": 1,
        "26004": 1,
        "26005": 1,
        "26006": 1,
        "26007": 2,
        "26008": 3,
        "26009": 2,
        "26010": 2,
        "26011": 1,
        "26012": 1,
        // Protection cards: "Jocasta, Protector, Victor Mancha, Flow Like Water x3, Indomitable x2, Defiance x3,
        // Side Step x3, Get Behind Me! x2, Preservation". 17 aspect cards.
        "26013": 1,
        "26014": 1,
        "26015": 1,
        "26016": 3,
        "26017": 2,
        "26018": 3,
        "26019": 3,
        "26020": 2,
        "26021": 1,
        // Basic cards: "Machine Man, Avengers Mansion, Reboot x3, Energy, Genius, Strength". 8 basic cards.
        // 16 + 17 + 8 = 41 (see the module doc comment above on this pack's 41-card precon).
        "26022": 1,
        "26023": 1,
        "26024": 3,
        "26025": 1,
        "26026": 1,
        "26027": 1,
      },
      obligationCode: "26028",
      nemesisCodes: ["26029", "26030", "26031", "26032"],
      verified: true,
      sources: [
        'Hall of Heroes Vision release page (https://hallofheroeslcg.com/vision/), "Starter Deck" link: ' +
          "https://hallofheroeslcg.com/wp-content/uploads/2022/01/vision-starter.jpg — image transcribed directly " +
          "(card-data-pipeline, wave 4).",
        "MarvelCDB public API card records for the vision pack (packages/content/raw/marvelcdb/vision.json) — " +
          "every card's quantityInSet/deckLimit matches the transcribed deck exactly.",
        'MarvelCDB community decklist "Vision - Precon" (https://marvelcdb.com/decklist/view/16198/vision-' +
          "precon-1.0, public API https://marvelcdb.com/api/public/decklist/16198) — independently reproduces the " +
          "same 25 card codes at the same quantities (sum 41), corroborating the Hall of Heroes transcription.",
      ],
      note:
        "41 cards = 16 Vision + 17 Protection + 8 Basic. Nemesis set (Ultron minion, Ultron Unleashed, Ultron " +
        "Drones environment, Relentless Android x2) matches the identity's own nemesisEncounterSetId.",
    },
  ],
};
