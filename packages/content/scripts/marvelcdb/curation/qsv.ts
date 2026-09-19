/**
 * Quicksilver Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/qsv.json`).
 * - "HoH gallery": the Hall of Heroes Quicksilver release page (https://hallofheroeslcg.com/quicksilver/), which
 *   hosts its own scan gallery separate from MarvelCDB's.
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N.
 *
 * Normalizes cleanly with one hand entry: Pietro Maximoff's alter-ego face (14001b) has no `imagesrc` at all on
 * MarvelCDB (confirmed by a direct 404 on MarvelCDB's own `/bundles/cards/14001b.png` and `.jpg` — not merely
 * absent from the cached pack response), which would otherwise make the pack fail `checkCoverage`'s "no artwork
 * reference" hard error (docs/phase7-wave2-data.md's earlier finding for this pack). Hall of Heroes' own release
 * page hosts a second, independent scan gallery for this product; its `0b.jpg` is Pietro Maximoff's alter-ego
 * face (viewed directly — title "Pietro Maximoff", "ALTER-EGO" banner, "HAND SIZE 6 / HIT POINTS 9" matching the
 * raw record, collector mark "1B"). Recorded as an `imageOverrides` entry rather than left as a hard failure or
 * guessed at (CLAUDE.md "Content & IP boundaries": stored as a reference URL, exactly the way a MarvelCDB path
 * is, not as downloaded bytes).
 *
 * **Starter deck not yet fully curated as data,** but its list is transcribed here from a real photo (see
 * `starterDecks` below) rather than left empty — matching wave 1's provenance discipline once the photo could
 * actually be read (Hall of Heroes' `qs.jpg`, the same release page, shows the printed decklist directly as text,
 * not requiring OCR-style guessing of a card image).
 */
import type { PackCuration } from "./types.ts";

export const QSV_CURATION: PackCuration = {
  packCode: "qsv",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "Quicksilver",
    releaseDate: "2021-02-05",
    releaseDateSource: "Hall of Heroes Quicksilver page (https://hallofheroeslcg.com/quicksilver/): \"Release date: February 5, 2021\"",
  },
  outDir: "src/data/qsv",
  exportPrefix: "QSV",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "qsv-protection",
      name: "Quicksilver (Protection) — Hero Pack starter deck",
      identityCode: "14001a",
      aspect: "protection",
      cards: {
        // Hero cards (14002-14011), each at its printed kit quantity.
        "14002": 1, "14003": 4, "14004": 2, "14005": 2, "14006": 1, "14007": 1, "14008": 1, "14009": 1, "14010": 1, "14011": 1,
        // Protection aspect cards.
        "14012": 3, "14013": 1, "14014": 3, "14015": 3, "14016": 2, "14017": 3,
        // Basic cards.
        "14018": 1, "14019": 1, "14020": 1, "14021": 1, "14022": 3, "14023": 3,
      },
      obligationCode: "14024",
      nemesisCodes: ["14025", "14026", "14027", "14028"],
      verified: true,
      sources: [
        "Hall of Heroes Quicksilver Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/12/qs.jpg, linked from https://hallofheroeslcg.com/quicksilver/)",
      ],
      note:
        "Cross-checked item-by-item against raw (qsv.json) by name, code and quantity: item 2 \"Scarlet Witch\" is 14002 (qty 1, the Team-Up ally printed in this hero kit, faction_code \"hero\"), and every Basic/Protection/nemesis item matches its listed code and quantity exactly (e.g. \"28 Earthquake x2\" = 14028, quantity 2 in raw).",
    },
  ],

  imageOverrides: {
    "14001b":
      "https://hallofheroeslcg.com/wp-content/uploads/2020/12/0b.jpg",
  },
};
