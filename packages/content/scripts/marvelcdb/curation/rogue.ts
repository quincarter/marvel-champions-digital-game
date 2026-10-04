/**
 * Rogue (Anna Marie) Hero Pack (Cycle 6) curation.
 *
 * One hand correction: Touched (38002) prints a dash cost — it is a "signature" upgrade whose text ("If Touched
 * is attached to a: ...") implies it enters play through Rogue's own hero-kit ability, not paid for from hand.
 * MarvelCDB sends no `cost` at all. Confirmed printed dash from the card's own MarvelCDB listing ("Cost: —"), the
 * same evidence standard used for trors' Hydra Campaign upgrades (docs/phase7-wave2.md §1.3/§5.1's `specialCost`
 * mechanism).
 *
 * Otherwise normalizes cleanly — the schema-neutral parser fixes (docs/phase7-wave2-data.md) already cover every
 * other shape this pack uses.
 *
 * **Precon:** transcribed 2026-10-01 from the pack's own printed decklist card (see `sources` below); no scenario data (hero pack).
 */
import type { PackCuration } from "./types.ts";

export const ROGUE_CURATION: PackCuration = {
  packCode: "rogue",
  cycle: { id: "cycle6", name: "Mutant Genesis", order: 6 },
  pack: {
    name: "Rogue",
    releaseDate: "2023-02-24",
    releaseDateSource:
      'Hall of Heroes Rogue/Anna Marie page (https://hallofheroeslcg.com/rogue-anna-marie/): "Release date: February 24, 2023"',
  },
  outDir: "src/data/rogue",
  exportPrefix: "ROGUE",

  corrections: [
    {
      code: "38002",
      reason:
        'Touched is a signature upgrade attached by Rogue\'s own hero-kit text, not played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/38002), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [
    {
      code: "38001b",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "Anna Marie: Setup and Withdrawn now find Touched and set it aside, not just set it aside. MarvelCDB (and the print) carry the old wording.",
      evidence: "RRG 1.8 p. 69, Rogue Hero Pack (#1A) errata; MarvelCDB (and the print) carry the old wording.",
      currentReplace: {
        find: "Setup: Set your Touched upgrade aside.\nWithdrawn — Forced Response: After you change to this form, set Touched aside.",
        replace:
          "Setup: Find your Touched upgrade and set it aside.\nWithdrawn — Forced Response: After you change to this form, find Touched and set it aside.",
      },
    },
    {
      code: "38001a",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Rogue, Skin Contact: "Attach Touched..." is now "Find Touched and attach it...".',
      evidence:
        "RRG 1.8 p. 69, Age of Apocalypse expansion (#1B) errata; MarvelCDB (and the print) carry the old wording.",
      currentReplace: {
        find: "Skin Contact — Action: Attach Touched to another character.",
        replace: "Skin Contact — Action: Find Touched and attach it to another character.",
      },
    },
    {
      code: "38007",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Energy Transfer: "Attach Touched..." is now "Find Touched and attach it...".',
      evidence:
        "RRG 1.8 p. 69, Age of Apocalypse expansion (#7) errata; MarvelCDB (and the print) carry the old wording.",
      currentReplace: {
        find: "Hero Action: Attach Touched to a character",
        replace: "Hero Action: Find Touched and attach it to a character",
      },
    },
    {
      code: "38026",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "Mystique's Manipulations: specifies who resolves the ability (the defeating player).",
      evidence:
        "RRG 1.8 p. 69, Age of Apocalypse expansion (#26) errata; MarvelCDB (and the print) carry the old wording.",
      currentReplace: {
        find: "When Defeated: Search the encounter deck and discard pile for a copy of the Misled treachery and shuffle it into your deck.",
        replace:
          "When Defeated: The defeating player searches the encounter deck and discard pile for a copy of the Misled treachery and shuffles it into their deck.",
      },
    },
    {
      code: "38031",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Bonebreaker: "Forced Interrupt" became "Forced Response". MarvelCDB already carries the current wording; the print reads Forced Interrupt.',
      evidence:
        "RRG 1.8 p. 69, Age of Apocalypse expansion (#31) errata; MarvelCDB's text already reads Forced Response.",
      printedReplace: {
        find: "Forced Response: After Bonebreaker engages you",
        replace: "Forced Interrupt: After Bonebreaker engages you",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "rogue-protection",
      name: "Rogue (Protection) — Rogue Hero Pack starter deck",
      identityCode: "38001a",
      aspect: "protection",
      cards: {
        "38002": 1, // Touched
        "38003": 1, // Gambit
        "38004": 1, // Rogue's Jacket
        "38005": 3, // Goin' Rogue
        "38006": 3, // Southern Cross
        "38007": 2, // Energy Transfer
        "38008": 2, // Bulletproof Belle
        "38009": 3, // Superpower Adaptation
        "38010": 1, // Iceman
        "38011": 1, // Karma
        "38012": 1, // Armor
        "38013": 3, // Unflappable
        "38014": 3, // Judoka Skill
        "38015": 3, // Preemptive Strike
        "38016": 3, // Not Today!
        "38017": 2, // Defensive Energy
        "38018": 1, // Moira MacTaggert
        "38019": 3, // X-Gene
        "38020": 1, // Beauty and the Thief
        "38021": 1, // Energy
        "38022": 1, // Genius
        "38023": 1, // Strength
      },
      obligationCode: "38024",
      nemesisCodes: ["38025", "38026", "38027"],
      verified: true,
      sources: [
        'Rogue Hero Pack printed decklist card, "Rogue Deck" (https://hallofheroeslcg.com/wp-content/uploads/2023/01/zzz-1.jpg, the "Starter Deck" link on the Hall of Heroes page, https://hallofheroeslcg.com/rogue-anna-marie/), transcribed 2026-10-01 from the card image',
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/rogue.json quantity/deck_limit (full printed quantity for each). The list totals 41 player cards (legal, 40-50).",
    },
  ],
};
