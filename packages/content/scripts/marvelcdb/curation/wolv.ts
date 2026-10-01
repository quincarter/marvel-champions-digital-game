/**
 * Wolverine (Logan) Hero Pack (Cycle 6) curation.
 *
 * One hand correction: Wolverine's Claws (35002) prints a dash cost — a "Permanent" signature weapon upgrade
 * exhausted for its Hero Action, not played for a resource cost. MarvelCDB sends no `cost` at all. Confirmed
 * printed dash from the card's own MarvelCDB listing ("Cost: —"), the same evidence standard used for trors'
 * Hydra Campaign upgrades (docs/phase7-wave2.md §1.3/§5.1's `specialCost` mechanism).
 *
 * Otherwise normalizes cleanly — the schema-neutral parser fixes (docs/phase7-wave2-data.md) already cover every
 * other shape this pack uses.
 *
 * **Precon:** transcribed 2026-10-01 from the pack's own printed decklist card (see `sources` below); no scenario data (hero pack).
 */
import type { PackCuration } from "./types.ts";

export const WOLV_CURATION: PackCuration = {
  packCode: "wolv",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Wolverine",
    releaseDate: "2022-11-11",
    releaseDateSource:
      'Hall of Heroes Logan/Wolverine page (https://hallofheroeslcg.com/logan-wolverine/): "Release date: November 11, 2022"',
  },
  outDir: "src/data/wolv",
  exportPrefix: "WOLV",

  corrections: [
    {
      code: "35002",
      reason:
        'Wolverine\'s Claws is a Permanent signature weapon, exhausted for its Hero Action rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/35002), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "wolverine-aggression",
      name: "Wolverine (Aggression) — Wolverine Hero Pack starter deck",
      identityCode: "35001a",
      aspect: "aggression",
      cards: {
        "35002": 1, // Wolverine's Claws
        "35003": 1, // Jubilee
        "35004": 1, // Adamantium Skeleton
        "35005": 1, // Berserker Frenzy
        "35006": 1, // I Got Better
        "35007": 1, // Logan's Cabin
        "35008": 2, // Berserker Barrage
        "35009": 2, // Slice and Dice
        "35010": 2, // Lunging Strike
        "35011": 2, // Track by Scent
        "35012": 2, // Regenerative Healing
        "35013": 1, // Psylocke
        "35014": 1, // Sunfire
        "35015": 3, // Battle Fury
        "35016": 3, // Warrior Skill
        "35017": 3, // Outta My Way!
        "35018": 3, // Precision Strike
        "35019": 3, // Mean Swing
        "35020": 2, // Aggressive Energy
        "35021": 1, // Colossus
        "35022": 1, // Weapon X
        "35023": 1, // Fastball Special
        "35024": 1, // Energy
        "35025": 1, // Genius
        "35026": 1, // Strength
      },
      obligationCode: "35027",
      nemesisCodes: ["35028", "35029", "35030", "35031"],
      verified: true,
      sources: [
        'Wolverine Hero Pack printed decklist card, "Wolverine Deck" (https://hallofheroeslcg.com/wp-content/uploads/2022/11/zzt.jpg, the "Starter Deck" link on the Hall of Heroes page, https://hallofheroeslcg.com/logan-wolverine/), transcribed 2026-10-01 from the card image',
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/wolv.json quantity/deck_limit (full printed quantity for each). The list totals 41 player cards (legal, 40-50).",
    },
  ],
};
