/**
 * Ms. Marvel Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/msm.json`).
 * - "deck photo": the Ms. Marvel Deck title-card back, printed decklist
 *   (https://hallofheroeslcg.com/wp-content/uploads/2019/12/msmarvelstarterdeck.jpg, linked from the Hall of
 *   Heroes Ms. Marvel page), viewed for verification only — not downloaded into the repo.
 * - "phase7 §N": docs/phase7-wave1.md section N.
 */
import type { PackCuration } from "./types.ts";

export const MSM_CURATION: PackCuration = {
  packCode: "msm",
  cycle: { id: "wave1", name: "Wave 1", order: 1 },
  pack: {
    name: "Ms. Marvel",
    releaseDate: "2019-12-20",
    releaseDateSource:
      'Hall of Heroes Ms. Marvel page (https://hallofheroeslcg.com/ms-marvel/): "Release date: December 20, 2019"',
  },
  outDir: "src/data/msm",
  exportPrefix: "MSM",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "05014":
      "Preemptive Strike carries raw attack=3/thwart=1 in MarvelCDB's data, but it is an event — printed events carry no ATK/THW stat box, and the schema's EventCard type has no such fields, so these two raw fields are simply not read. Its actual ability (\"cancel all boost icons... deal 1 damage to the villain for each boost icon cancelled\") has nothing to do with those numbers [evidence: raw; phase7 §1.12].",
  },

  scenarios: [],

  starterDecks: [
    {
      id: "msm-protection",
      name: "Ms. Marvel (Protection) — Hero Pack starter deck",
      identityCode: "05001a",
      aspect: "protection",
      cards: {
        "05002": 1,
        "05003": 3,
        "05004": 3,
        "05005": 2,
        "05006": 1,
        "05007": 1,
        "05008": 1,
        "05009": 1,
        "05010": 1,
        "05011": 1,
        "05012": 1,
        "05013": 2,
        "05014": 3,
        "05015": 3,
        "05016": 2,
        "05017": 3,
        "05018": 1,
        "05019": 1,
        "05020": 1,
        "05021": 1,
        "05022": 1,
        "05023": 3,
        "05024": 3,
      },
      obligationCode: "05025",
      nemesisCodes: ["05026", "05027", "05028", "05029"],
      verified: true,
      sources: [
        "Ms. Marvel Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2019/12/msmarvelstarterdeck.jpg, linked from https://hallofheroeslcg.com/ms-marvel/)",
      ],
    },
  ],
};
