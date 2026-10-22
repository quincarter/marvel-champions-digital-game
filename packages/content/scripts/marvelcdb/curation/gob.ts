/**
 * Green Goblin Scenario Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/gob.json`), read directly —
 *   MarvelCDB's `real_text`/`text` field, not a second source, but load-bearing when it's what the emitted card
 *   text is built from.
 * - "phase7 §N": docs/phase7-wave1.md section N, which already carries the RRG/insert/ruling citation for the
 *   fact being used here (this file doesn't re-derive those; it applies them to specific MarvelCDB codes).
 * - "HoH": the Hall of Heroes Green Goblin release page (https://hallofheroeslcg.com/green-goblin/), fetched
 *   2026-09-13.
 */
import type { PackCuration } from "./types.ts";

export const GOB_CURATION: PackCuration = {
  packCode: "gob",
  cycle: { id: "wave1", name: "Wave 1", order: 1 },
  pack: {
    name: "Green Goblin",
    releaseDate: "2019-12-20",
    releaseDateSource:
      'Hall of Heroes Green Goblin page (https://hallofheroeslcg.com/green-goblin/): "Release date: December 20, 2019"',
  },
  outDir: "src/data/gob",
  exportPrefix: "GOB",

  corrections: [
    {
      code: "02002b",
      reason: 'MarvelCDB reads "Deal 3 indirect damage to each player." on Green Goblin II; the card prints 4 (#361).',
      evidence:
        'Card scan assets/card-art/bundles/cards/02002b.png: "When Revealed: Deal 4 indirect damage to each player." The other Norman Osborn / Green Goblin faces (02001a-02003b) and the Mutagen Formula stages (02014-02016) were checked against their scans and match raw.',
      textReplace: {
        find: "Deal 3 indirect damage to each player.",
        replace: "Deal 4 indirect damage to each player.",
      },
    },
  ],
  errata: [],

  scriptingNotes: {
    "02004b.when-completed":
      'RRG 1.8 "When Completed Abilities" (p.48): equivalent to a Forced Interrupt on this stage (Hostile Takeover 1B) being completed, resolving before the scheme advances. Not the same as When Defeated.',
    "02017b.when-completed": "Same shape as 02004b.when-completed, on Unleashing the Mutagen 1B.",
  },

  cardNotes: {
    "02008":
      'Guard minion (Private Security Specialist). Printed SCH is 0 (not "—"): raw scheme=0, not absent [evidence: raw; phase7 §1.12].',
  },

  scenarios: [
    {
      id: "risky-business",
      name: "Risky Business",
      villainSetCode: "risky_business",
      // Green Goblin insert, "Adjustable Difficulty": "include no modular encounter sets for an easier challenge or
      // multiple sets for a greater challenge"; recommended pairing per Hall of Heroes: Power Drain (phase7 §2.2).
      recommendedModularSetCodes: ["power_drain"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      // Norman Osborn I–II (standard) / II–III (expert), starting on Norman (side A) — phase7 §1.2, §1.3, §2.2.
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence:
        'Green Goblin insert "How to Use This Pack"/"Adjustable Difficulty" (quoted docs/phase7-wave1.md §1.3, §2.2); Hostile Takeover 1A Contents text (raw 02004a); HoH Green Goblin page ("Risky Business (Scenario 1 - Suggested Pairing: Power Drain)")',
    },
    {
      id: "mutagen-formula",
      name: "Mutagen Formula",
      villainSetCode: "mutagen_formula",
      // HoH: "Mutagen Formula (Scenario 2 - Suggested Pairing: Goblin Gimmicks)".
      recommendedModularSetCodes: ["goblin_gimmicks"],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      evidence:
        'Green Goblin insert "Adjustable Difficulty"; Unleashing the Mutagen 1A Contents text (raw 02017a); HoH Green Goblin page ("Mutagen Formula (Scenario 2 - Suggested Pairing: Goblin Gimmicks)")',
    },
  ],

  starterDecks: [],
};
