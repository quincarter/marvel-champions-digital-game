/**
 * Hulk Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/hlk.json`).
 * - "deck photo": the Hulk Deck title-card back, printed decklist
 *   (https://hallofheroeslcg.com/wp-content/uploads/2020/06/hulkstarterdeck-1.jpg, linked from the Hall of Heroes
 *   Hulk page), viewed for verification only — not downloaded into the repo.
 * - "phase7 §N": docs/phase7-wave1.md section N.
 */
import type { PackCuration } from "./types.ts";

export const HLK_CURATION: PackCuration = {
  packCode: "hlk",
  cycle: { id: "wave1", name: "Wave 1", order: 1 },
  pack: {
    name: "Hulk",
    releaseDate: "2020-08-07",
    releaseDateSource:
      'Hall of Heroes Hulk page (https://hallofheroeslcg.com/bruce-banner-hulk/): "Release date: August 7, 2020 (originally June, 2020)"',
  },
  outDir: "src/data/hlk",
  exportPrefix: "HLK",

  corrections: [
    {
      code: "10031",
      textReplace: { find: "Player under any player's control.", replace: "Play under any player's control." },
      reason:
        'MarvelCDB typo ("Player" for "Play"). Left uncorrected the parser doesn\'t recognize the restriction sentence at all and it silently becomes ordinary constant ability text instead of an anyPlayerControl play restriction — verified directly against parseCardText.',
      evidence:
        'raw; phase7 §1.12; every other wave 1 card printing this restriction (msm 05009/05017 area, thor, drs, hlk 10032) reads "Play under"',
    },
    {
      code: "10028",
      name: "Clash of the Titans",
      reason:
        'MarvelCDB title-cases "Of The"; the printed title lowercases both, confirmed on the deck\'s own printed decklist ("Clash of the Titans x3").',
      evidence: 'deck photo ("28 Clash of the Titans x3")',
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "10001a":
      'Hulk\'s printed THW is explicitly 0 (not a dash) — raw thwart=0. Unlike the Core Hulk ally (01050, printed "—"), the Hulk hero identity can thwart [evidence: raw; phase7 §1.12].',
  },

  scenarios: [],

  starterDecks: [
    {
      id: "hlk-aggression",
      name: "Hulk (Aggression) — Hero Pack starter deck",
      identityCode: "10001a",
      aspect: "aggression",
      cards: {
        "10002": 2,
        "10003": 2,
        "10004": 2,
        "10005": 2,
        "10006": 2,
        "10007": 2,
        "10008": 1,
        "10009": 1,
        "10010": 1,
        "10011": 1,
        "10012": 1,
        "10013": 1,
        "10014": 3,
        "10015": 3,
        "10016": 3,
        "10017": 2,
        "10018": 3,
        "10019": 3,
        "10020": 1,
        "10021": 1,
        "10022": 1,
        "10023": 1,
        "10024": 1,
      },
      obligationCode: "10025",
      nemesisCodes: ["10026", "10027", "10028"],
      verified: true,
      sources: [
        "Hulk Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/06/hulkstarterdeck-1.jpg, linked from https://hallofheroeslcg.com/bruce-banner-hulk/)",
      ],
    },
  ],
};
