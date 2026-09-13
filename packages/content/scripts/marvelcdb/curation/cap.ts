/**
 * Captain America Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/cap.json`).
 * - "deck photo": the Captain America Deck title-card back, printed decklist
 *   (https://hallofheroeslcg.com/wp-content/uploads/2020/06/capamericadeck-1.jpg, linked from the Hall of Heroes
 *   Captain America page), viewed for verification only — not downloaded into the repo (CLAUDE.md "Content & IP
 *   boundaries").
 * - "phase7 §N": docs/phase7-wave1.md section N.
 */
import type { PackCuration } from "./types.ts";

export const CAP_CURATION: PackCuration = {
  packCode: "cap",
  cycle: { id: "wave1", name: "Wave 1", order: 1 },
  pack: {
    name: "Captain America",
    releaseDate: "2019-12-20",
    releaseDateSource: "Hall of Heroes Captain America page (https://hallofheroeslcg.com/captain-america/): \"Release date: December 20, 2019\"",
  },
  outDir: "src/data/cap",
  exportPrefix: "CAP",

  corrections: [
    {
      code: "03017",
      name: "Strength in Numbers",
      reason: 'MarvelCDB capitalizes "In"; the printed title lowercases it, confirmed on the deck\'s own printed decklist.',
      evidence: "deck photo (\"17 Strength in Numbers x3\")",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "03025": "Honorary Avenger errata (RRG 1.8 p.65) added \"Max 1 per character.\" on top of the printed \"Play only if your identity has the Avenger trait.\" — data only carries the current playRestrictions shape (maxPerHost + requiresIdentityTrait); MarvelCDB's text already reflects the current wording.",
    "03015": "MarvelCDB's raw text has a stray closing </i> tag after \"Hero Action</b>\" with no matching open tag. No effect on the emitted card text — toPlainText strips all HTML tags unconditionally, so this never reaches a Correction's textReplace (which runs on the already-stripped text); recorded here only so the source anomaly is documented [evidence: raw; phase7 §1.12].",
  },

  scenarios: [],

  starterDecks: [
    {
      id: "cap-leadership",
      name: "Captain America (Leadership) — Hero Pack starter deck",
      identityCode: "03001a",
      aspect: "leadership",
      cards: {
        // Hero cards (03002-03010), each at its printed kit quantity.
        "03002": 1, "03003": 2, "03004": 3, "03005": 2, "03006": 2, "03007": 1, "03008": 1, "03009": 1, "03010": 2,
        // Leadership aspect cards.
        "03011": 1, "03012": 1, "03013": 1, "03014": 1, "03015": 3, "03016": 2, "03017": 3, "03018": 2, "03019": 3,
        // Basic cards.
        "03020": 1, "03021": 1, "03022": 1, "03023": 1, "03024": 1, "03025": 3,
      },
      obligationCode: "03026",
      nemesisCodes: ["03027", "03028", "03029", "03030"],
      verified: true,
      sources: [
        "Captain America Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/06/capamericadeck-1.jpg, linked from https://hallofheroeslcg.com/captain-america/)",
      ],
    },
  ],
};
