/**
 * War Machine (James Rhodes) Hero Pack (Cycle 4) curation.
 *
 * Normalizes cleanly with no hand corrections needed. RRG 1.8 p. 67's James Rhodes (#1B) errata ("Added '(Limit
 * once per phase.)'") is already reflected in MarvelCDB's cached text (raw `errata` note confirms it), so no
 * curated `Errata` entry was needed.
 *
 * Starter deck curated wave 4 (below).
 */
import type { PackCuration } from "./types.ts";

export const WARM_CURATION: PackCuration = {
  packCode: "warm",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "War Machine",
    releaseDate: "2021-11-12",
    releaseDateSource:
      'Hall of Heroes War Machine page (https://hallofheroeslcg.com/war-machine/): "Release date: November 12, 2021"',
  },
  outDir: "src/data/warm",
  exportPrefix: "WARM",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "war-machine-leadership",
      name: "War Machine (Leadership) — starter deck",
      identityCode: "23001a",
      aspect: "leadership",
      cards: {
        // War Machine cards (23002-23011), Hall of Heroes starter-deck image ("War Machine Deck"): "Iron Man,
        // Munitions Bunker, Upgraded Chassis, Gauntlet Gun x2, Missile Launcher, Shoulder Cannon, Repulsor Beam x2,
        // Targeted Strike x2, Scorched Earth x2, Full Auto x2". 15 hero cards.
        "23002": 1,
        "23003": 1,
        "23004": 1,
        "23005": 2,
        "23006": 1,
        "23007": 1,
        "23008": 2,
        "23009": 2,
        "23010": 2,
        "23011": 2,
        // Leadership cards: "Black Panther, Captain Marvel, Falcon, Goliath, Command Team x3, Sneak Attack x3,
        // Save the Day x3, Go Down Swinging x3, Make the Call x2, Innovation". 19 aspect cards.
        "23012": 1,
        "23013": 1,
        "23014": 1,
        "23015": 1,
        "23016": 3,
        "23017": 3,
        "23018": 3,
        "23019": 3,
        "23020": 2,
        "23021": 1,
        // Basic cards: "Mockingbird, Quincarrier, Two Against the World, Energy, Genius, Strength". 6 basic
        // cards. 15 + 19 + 6 = 40.
        "23022": 1,
        "23023": 1,
        "23024": 1,
        "23025": 1,
        "23026": 1,
        "23027": 1,
      },
      obligationCode: "23028",
      nemesisCodes: ["23029", "23030", "23031"],
      verified: true,
      sources: [
        'Hall of Heroes War Machine release page (https://hallofheroeslcg.com/war-machine/), "Starter Deck" link: ' +
          "https://hallofheroeslcg.com/wp-content/uploads/2021/10/wm-card.jpg — image transcribed directly " +
          "(card-data-pipeline, wave 4).",
        "MarvelCDB public API card records for the warm pack (packages/content/raw/marvelcdb/warm.json) — every " +
          "card's quantityInSet/deckLimit matches the transcribed deck exactly.",
      ],
      note:
        "40 cards = 15 War Machine + 19 Leadership + 6 Basic, matching the printed deck-list card's own counts. " +
        "Nemesis set (Living Laser minion, Deadly Light Show, Laser Strike x3) matches the identity's own " +
        "nemesisEncounterSetId.",
    },
  ],
};
