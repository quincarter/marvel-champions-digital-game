/**
 * Thor Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/thor.json`).
 * - "deck photo": the Thor Deck title-card back, printed decklist
 *   (https://hallofheroeslcg.com/wp-content/uploads/2020/03/thorstarterdeck1.jpg, linked from the Hall of Heroes
 *   Thor page), viewed for verification only — not downloaded into the repo.
 * - "phase7 §N": docs/phase7-wave1.md section N.
 */
import type { PackCuration } from "./types.ts";

export const THOR_CURATION: PackCuration = {
  packCode: "thor",
  cycle: { id: "wave1", name: "Wave 1", order: 1 },
  pack: {
    name: "Thor",
    releaseDate: "2020-03-06",
    releaseDateSource: 'Hall of Heroes Thor page (https://hallofheroeslcg.com/thor/): "Release date: March 6, 2020"',
  },
  outDir: "src/data/thor",
  exportPrefix: "THOR",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "06032":
      "This event's printed title is \"Teamwork\" — the same word as the (unimplemented in wave 1) Teamwork trait/keyword. The parser only recognizes keyword lines inside a card's own text, never a card's `name`, so this is not read as the keyword [evidence: raw; phase7 §1.10].",
  },

  scenarios: [],

  starterDecks: [
    {
      id: "thor-aggression",
      name: "Thor (Aggression) — Hero Pack starter deck",
      identityCode: "06001a",
      aspect: "aggression",
      cards: {
        "06002": 1,
        "06003": 3,
        "06004": 1,
        "06005": 3,
        "06006": 2,
        "06007": 1,
        "06008": 2,
        "06009": 1,
        "06010": 1,
        "06011": 1,
        "06012": 1,
        "06013": 2,
        "06014": 3,
        "06015": 3,
        "06016": 2,
        "06017": 1,
        "06018": 3,
        "06019": 1,
        "06020": 1,
        "06021": 3,
        "06022": 1,
        "06023": 1,
        "06024": 1,
        "06025": 1,
      },
      obligationCode: "06026",
      nemesisCodes: ["06027", "06028", "06029", "06030"],
      verified: true,
      sources: [
        "Thor Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/03/thorstarterdeck1.jpg, linked from https://hallofheroeslcg.com/thor/)",
      ],
    },
  ],
};
