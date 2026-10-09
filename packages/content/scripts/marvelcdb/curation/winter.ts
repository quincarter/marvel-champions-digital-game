/**
 * Winter Soldier (Bucky Barnes) Hero Pack (Cycle 9) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const WINTER_CURATION: PackCuration = {
  packCode: "winter",
  cycle: { id: "cycle9", name: "Agents of S.H.I.E.L.D.", order: 9 },
  pack: {
    name: "Winter Soldier",
    releaseDate: "2025-06-20",
    releaseDateSource:
      'Hall of Heroes Winter Soldier page (https://hallofheroeslcg.com/winter-soldier-bucky-barnes/): "Release date: June 20, 2025"',
  },
  outDir: "src/data/winter",
  exportPrefix: "WINTER",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "winter-aggression",
      name: "Winter Soldier (Aggression) — Winter Soldier Hero Pack starter deck",
      identityCode: "54001a",
      aspect: "aggression",
      cards: {
        "54002": 1, // Cybernetic Arm
        "54003": 1, // Black Widow
        "54004": 2, // Arm Block
        "54005": 3, // Metal Punch
        "54006": 2, // Electrical Discharge
        "54007": 1, // Safe House #30
        "54008": 2, // Silent Infiltration
        "54009": 1, // Winter Armor
        "54010": 1, // Winter Mask
        "54011": 1, // Winter Rifle
        "54012": 1, // Captain America
        "54013": 1, // Deathlok
        "54014": 3, // Firepower
        "54015": 3, // One by One
        "54016": 3, // Spoiling for a Fight
        "54017": 3, // Aggressive Stance
        "54018": 1, // Bambino
        "54019": 1, // Man on the Wall
        "54020": 3, // S.H.I.E.L.D. Sidearm
        "54021": 1, // Nick Fury, Sr.
        "54022": 1, // Super-Soldiers
        "54023": 1, // Winter, Widow, Soldier, Spy
        "54024": 1, // Energy
        "54025": 1, // Genius
        "54026": 1, // Strength
      },
      obligationCode: "54027",
      nemesisCodes: ["54028", "54029", "54030", "54031"],
      verified: true,
      sources: [
        'Hall of Heroes "Starter Deck" decklist card image for this pack (wp-content/uploads/2026/01), read card by card and transcribed in docs/phase7-wave9-data-survey.md section 6.2',
      ],
      note: "40 cards by script: 15 Winter Soldier hero cards, the aggression aspect cards and basic cards from the printed decklist (identity, obligation and nemesis set excluded). Printed card numbers equal the codes' last digits. Copies come from raw/marvelcdb/winter.json quantities except where the deck prints fewer than the pack contains.",
    },
  ],
};
