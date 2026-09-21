/**
 * Black Widow Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/bkw.json`).
 * - "deck photo": the Black Widow Deck title-card back, printed decklist
 *   (https://hallofheroeslcg.com/wp-content/uploads/2020/04/widowstarterdeck.jpg, linked from the Hall of Heroes
 *   Black Widow page), viewed for verification only — not downloaded into the repo.
 * - "RRG p.66": mc_rulesreference_v18_compressed.pdf Appendix V (errata).
 * - "ruling Feb 28 (2)": marvel-champions-rulings-post-rrg-1-7.md, the Feb 28, 2026 ruling entry #2.
 */
import type { PackCuration } from "./types.ts";

export const BKW_CURATION: PackCuration = {
  packCode: "bkw",
  cycle: { id: "wave1", name: "Wave 1", order: 1 },
  pack: {
    name: "Black Widow",
    releaseDate: "2020-06-05",
    releaseDateSource:
      'Hall of Heroes Black Widow page (https://hallofheroeslcg.com/natasha-romanoff-black-widow/): "Release date: June 5, 2020 (originally April 3, 2020)"',
  },
  outDir: "src/data/bkw",
  exportPrefix: "BKW",

  corrections: [],
  errata: [
    {
      code: "08001a",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Changed "trigger" to "resolve": "Widowmaker" now reads "After you resolve the ability of a Preparation card you control...".',
      evidence:
        "RRG p.66 errata (\"Changed 'trigger' to 'resolve'.\"); ruling Feb 28 (2) (\"Both Black Widow and Synth-Suit should say 'resolve'.\"); MarvelCDB carries no `errata` field for this card and its text still reads \"trigger\" (verified as the un-updated print, not a second wording)",
      // MarvelCDB's own text is the *original print* here (it hasn't picked up the errata), so the current wording
      // is derived forward from it instead of reconstructing the print by reversing an already-current MarvelCDB
      // text (curation/types.ts `Errata.currentReplace`).
      currentReplace: { find: "trigger the ability", replace: "resolve the ability" },
    },
    {
      code: "08009",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Changed "trigger" to "resolve": Synth-Suit\'s Hero Response now reads "After you resolve the ability of a Preparation card you control...".',
      evidence: 'RRG p.66 errata; ruling Feb 28 (2); MarvelCDB text still reads "trigger" with no `errata` field set',
      currentReplace: { find: "trigger the ability", replace: "resolve the ability" },
    },
  ],

  scriptingNotes: {},
  cardNotes: {
    "08026":
      "Taskmaster's printed ATK/SCH are 0★ (the ★ is a reminder that both are boosted by this card's own Boost ability, not a printed non-zero value). raw attack=0/scheme=0, not absent [evidence: raw; phase7 §1.12].",
    "08028":
      'Guard minion (Hydra Mercenary). Printed SCH is 0 (not "—"): raw scheme=0, not absent [evidence: raw; phase7 §1.12].',
  },

  scenarios: [],

  starterDecks: [
    {
      id: "bkw-justice",
      name: "Black Widow (Justice) — Hero Pack starter deck",
      identityCode: "08001a",
      aspect: "justice",
      cards: {
        "08002": 1,
        "08003": 2,
        "08004": 2,
        "08005": 1,
        "08006": 2,
        "08007": 2,
        "08008": 2,
        "08009": 1,
        "08010": 2,
        "08011": 1,
        "08012": 1,
        "08013": 3,
        "08014": 2,
        "08015": 2,
        "08016": 2,
        "08017": 3,
        "08018": 3,
        "08019": 1,
        "08020": 1,
        "08021": 1,
        "08022": 1,
        "08023": 1,
        "08024": 3,
      },
      obligationCode: "08025",
      nemesisCodes: ["08026", "08027", "08028", "08029"],
      verified: true,
      sources: [
        "Black Widow Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/04/widowstarterdeck.jpg, linked from https://hallofheroeslcg.com/natasha-romanoff-black-widow/)",
      ],
    },
  ],
};
