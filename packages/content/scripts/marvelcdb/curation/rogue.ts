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
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
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
  errata: [],

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
