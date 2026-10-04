/**
 * Gambit (Remy LeBeau) Hero Pack (Cycle 6) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Precon:** transcribed 2026-10-01 from the pack's own printed decklist card (see `sources` below); no scenario data (hero pack).
 */
import type { PackCuration } from "./types.ts";

export const GAMBIT_CURATION: PackCuration = {
  packCode: "gambit",
  cycle: { id: "cycle6", name: "Mutant Genesis", order: 6 },
  pack: {
    name: "Gambit",
    releaseDate: "2023-02-24",
    releaseDateSource:
      'Hall of Heroes Gambit page (https://hallofheroeslcg.com/gambit-remy-lebeau/): "Release date: February 24, 2023"',
  },
  outDir: "src/data/gambit",
  exportPrefix: "GAMBIT",

  corrections: [],
  errata: [
    {
      code: "37034",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Psionic Shield: removed "and put it back into play". MarvelCDB already carries the current wording; the scan (assets/card-art/bundles/cards/37034.png) prints it.',
      evidence: "RRG 1.8 p. 68, Gambit Hero Pack (#34) errata; card scan 37034.png.",
      printedReplace: {
        find: "heal all damage from that minion. Then, discard",
        replace: "heal all damage from that minion and put it back into play. Then, discard",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "gambit-justice",
      name: "Gambit (Justice) — Gambit Hero Pack starter deck",
      identityCode: "37001a",
      aspect: "justice",
      cards: {
        "37002": 1, // Rogue
        "37003": 1, // The Thieves Guild
        "37004": 1, // Gambit's Staff
        "37005": 1, // Gambit's Guild Armor
        "37006": 3, // Charged Card
        "37007": 2, // Royal Flush
        "37008": 2, // Natural Agility
        "37009": 2, // Creole Charmer
        "37010": 2, // Molecular Acceleration
        "37011": 1, // Bishop
        "37012": 1, // Dazzler
        "37013": 3, // Operative Skill
        "37014": 3, // Stealth Strike
        "37015": 3, // Breaking and Entering
        "37016": 2, // Passion for Justice
        "37017": 1, // Professor X
        "37018": 1, // X-Mansion
        "37019": 1, // Beauty and the Thief
        "37020": 3, // Hit and Run
        "37021": 3, // Mutant Education
        "37022": 1, // Energy
        "37023": 1, // Genius
        "37024": 1, // Strength
      },
      obligationCode: "37025",
      nemesisCodes: ["37026", "37027", "37028", "37029"],
      verified: true,
      sources: [
        'Gambit Hero Pack printed decklist card, "Gambit Deck" (https://hallofheroeslcg.com/wp-content/uploads/2023/01/zzz.jpg, the "Starter Deck" link on the Hall of Heroes page, https://hallofheroeslcg.com/gambit-remy-lebeau/), transcribed 2026-10-01 from the card image',
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/gambit.json quantity/deck_limit (full printed quantity for each). The list totals 40 player cards (legal, 40-50).",
    },
  ],
};
