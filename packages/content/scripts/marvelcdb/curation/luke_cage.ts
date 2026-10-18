/**
 * Luke Cage Hero Pack (MC62, cycle 11, Fear No Evil wave) curation.
 *
 * Evidence abbreviations: "scan" is `assets/card-art/bundles/cards/<code>.png` (gitignored, read directly, never wired
 * into the data), "survey" is docs/phase7-wave11-data-survey.md and "spec" is docs/phase7-wave11-hero-packs.md (H1,
 * H3.23). Emitted after `jj`: 62024 Unbreakable Bond reprints 61027 (verbatim, survey section 7).
 *
 * Scans read for this curation: 62001a/b to 62011, 62020, 62023, 62028 to 62037 (every card whose raw record carries no
 * `imagesrc`, plus the identity, the ally and the dash card). Each matched raw in text, cost, stats and traits except:
 * - 62010 prints "Luke Cage gains retaliate 1."; raw says "gets". A text correction (printed text, not errata).
 * - 62010's title is "Metal Bracer" on the scan (the rulings pages say "Metal Bracelet"; spec H3.23 settles the raw
 *   name, and the scan confirms it). No name correction.
 * - 62020 Hulk prints THW as a dash (scan); raw sends no `thwart`. Left as the normalizer reads it, with a note.
 * - 62002 Jessica Jones, 62013 Misty Knight (THW and ATK), 62029 Cottonmouth (ATK), 62031 Augmented Jaws (ATK) and
 *   62032 Asp (SCH) print a star on that stat (scan); raw carries the matching `*_star` flags, so nothing to correct.
 * - 62006 "Sweet Christmas!" has `cost_star` beside a printed number: its cost is 5 (a number, with a star on its
 *   reduction text), not `SpecialCost` "star".
 * - Starter deck: no printed list exists (survey section 10), so MarvelCDB decklist 65136 stands in, `verified: false`.
 */
import type { PackCuration } from "./types.ts";

export const LUKE_CAGE_CURATION: PackCuration = {
  packCode: "luke_cage",
  cycle: { id: "cycle11", name: "Fear No Evil", order: 11 },
  pack: {
    name: "Luke Cage",
    releaseDate: "2026-08-21",
    releaseDateSource:
      'MarvelCDB pack list (https://marvelcdb.com/api/public/packs/, code luke_cage, "available": "2026-08-21"), also the day decklist 65136 was posted; a pointer, since FFG gives only "August, 2026".',
  },
  outDir: "src/data/luke_cage",
  exportPrefix: "LUKE_CAGE",

  corrections: [
    {
      code: "62010",
      reason:
        'MarvelCDB reads "Luke Cage gets retaliate 1."; the card prints "Luke Cage gains retaliate 1." The title stays "Metal Bracer" (the scan prints it; the FFG rulings of June 25 and July 9, 2026 call the card "Metal Bracelet", spec H3.23).',
      evidence:
        'Card scan assets/card-art/bundles/cards/62010.png: "Luke Cage gains retaliate 1."; title "Metal Bracer".',
      textReplace: { find: "gets retaliate 1", replace: "gains retaliate 1" },
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "62010":
      'Printed title is "Metal Bracer" (scan). The June 25 and July 9, 2026 rulings say "Metal Bracelet" and mean this card by its text (Luke Cage, reduce by 1); the raw name is kept (spec H3.23).',
    "62020":
      "Hulk: THW prints as a dash (scan; raw sends no thwart), so he cannot thwart. ATK 2, HP 5, cost 4, Defender. Gamma. Counter type: rage.",
    "62002":
      "Jessica Jones (ally): THW prints 1 with a star (+1 THW per tough status card on your identity, max +4 THW).",
  },

  scenarios: [],
  starterDecks: [
    {
      id: "luke-cage-leadership",
      name: "Luke Cage (Leadership) — Luke Cage Hero Pack starter deck",
      identityCode: "62001a",
      aspect: "leadership",
      cards: {
        "62002": 1, // Jessica Jones
        "62003": 2, // Harlem's Hero
        "62004": 1, // Knuckle Sandwich
        "62005": 2, // "Stand with Me!"
        "62006": 2, // "Sweet Christmas!"
        "62007": 1, // Fogwell's Gym
        "62008": 1, // Burstein Process
        "62009": 2, // Cruisin' for a Bruisin'
        "62010": 2, // Metal Bracer
        "62011": 1, // Power Man
        "62012": 1, // Iron Fist
        "62013": 1, // Misty Knight
        "62014": 1, // Valkyrie
        "62015": 3, // Take a Stand
        "62016": 1, // Innovation
        "62017": 2, // The Power of Leadership
        "62018": 3, // Defensive Formation
        "62019": 3, // Righteous Purpose
        "62020": 1, // Hulk
        "62021": 1, // She-Hulk
        "62022": 3, // Dynamic Duo
        "62023": 1, // Power Man and Iron Fist
        "62024": 1, // Unbreakable Bond
        "62025": 1, // Energy
        "62026": 1, // Genius
        "62027": 1, // Strength
      },
      obligationCode: "62028", // Internal Injury
      nemesisCodes: ["62029", "62030", "62031", "62032", "62033"], // Cottonmouth, Venomous Whispers, Augmented Jaws, Asp, Sidewinder
      verified: false,
      sources: [
        'STAND-IN, NOT A PRINTED LIST: no decklist card or insert page for Luke Cage is available (the Hall of Heroes page prints "Starter Deck" as plain text; the MC62 insert has no list). Counts follow MarvelCDB public decklist 65136 ("Luke Cage - precon deck", posted 2026-08-21), as tabulated in docs/phase7-wave11-data-survey.md section 10. Every copy count is within the record\'s quantity. Replace with the printed list when the owner supplies it.',
      ],
      note: "40 cards. Unverified against the printed card.",
    },
  ],
};
