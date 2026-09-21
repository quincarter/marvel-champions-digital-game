/**
 * The Wrecking Crew Scenario Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/twc.json`).
 * - "phase7 §N": docs/phase7-wave1.md section N (already carries the insert/RRG/ruling citation).
 * - "insert": The Wrecking Crew Scenario Pack rules insert (cited by docs/phase7-wave1.md §0/§1.1/§2.3; not
 *   refetched here — the setup diagram naming Piledriver is quoted directly in phase7-wave1.md §1.12).
 * - "HoH": the Hall of Heroes Wrecking Crew release page (https://hallofheroeslcg.com/wrecking-crew/), fetched
 *   2026-09-13.
 */
import type { PackCuration } from "./types.ts";

export const TWC_CURATION: PackCuration = {
  packCode: "twc",
  cycle: { id: "wave1", name: "Wave 1", order: 1 },
  pack: {
    name: "The Wrecking Crew",
    releaseDate: "2020-02-07",
    releaseDateSource:
      'Hall of Heroes The Wrecking Crew page (https://hallofheroeslcg.com/wrecking-crew/): "Release date: February 7, 2020"',
  },
  outDir: "src/data/twc",
  exportPrefix: "TWC",

  corrections: [
    {
      code: "07034",
      textReplace: {
        find: "This card cannot leave play while Wrecker is in play.",
        replace: "This card cannot leave play while Piledriver is in play.",
      },
      reason:
        "Pile It On! is Piledriver's signature side scheme (its own \"Piledriver's Side Scheme.\" line, immediately above); MarvelCDB's text names the wrong villain. The printed card, per the Wrecking Crew insert's setup diagram, reads \"while Piledriver is in play\".",
      evidence:
        'insert setup diagram (quoted docs/phase7-wave1.md §1.12); raw (the card\'s own preceding "Piledriver\'s Side Scheme." line contradicts MarvelCDB\'s "Wrecker")',
    },
    {
      code: "07005",
      textReplace: { find: "attacked scheme", replace: "attached scheme" },
      reason:
        'MarvelCDB typo on the Wrecker copy of Held Hostage only; the other three copies (07021/07036/07050) all read "attached scheme" — this is the odd one out, not a printed variation.',
      evidence: 'raw (07021/07036/07050 all read "attached scheme"); phase7 §1.12',
    },
    {
      code: "07036",
      textReplace: {
        find: "Attach to the active villain side scheme.",
        replace: "Attach to the active villain's side scheme.",
      },
      reason:
        'MarvelCDB drops the possessive on the Piledriver copy of Held Hostage. Without it the parser\'s attach-rule matcher falls through to a generic "the (.+) side scheme" pattern and produces the wrong AttachmentHost (a bogus namedCard "active villain" instead of villainSideScheme) — confirmed by parsing this exact sentence before and after the fix. The Wrecker/Thunderball copies (07005/07021) already print the apostrophe.',
      evidence:
        'raw (07005/07021 read "the active villain\'s side scheme"); phase7 §1.12; parser behavior verified directly against parseCardText',
    },
    {
      code: "07050",
      textReplace: {
        find: "Attach to the active villain side scheme.",
        replace: "Attach to the active villain's side scheme.",
      },
      reason: "Same missing possessive as 07036, on the Bulldozer copy of Held Hostage.",
      evidence: 'raw (07005/07021 read "the active villain\'s side scheme"); phase7 §1.12',
    },
  ],
  errata: [],

  scriptingNotes: {
    "07001a.setup":
      'Put the Day of Reckoning, Thunderstruck, Pile It On!, and Clear the Road side schemes into play (one per villain, matching each side scheme\'s signatureOf). Place the active counter on Wrecker (07002). "Advance to stage 1B" is implicit in the engine.',
    "07001b.breakout-forced-response":
      "After villain-phase step one: place 1 threat on each of the four side schemes (not the main scheme), then move the active counter to the villain whose signature side scheme now has the most threat (tie: first player chooses).",
  },

  cardNotes: {
    "07002":
      "Wrecker A/B, single-sided (no Norman-Osborn-style flip). Signature side scheme: Day of Reckoning (07004).",
    "07017": "Thunderball A/B, single-sided. Signature side scheme: Thunderstruck (07019).",
    "07032": "Piledriver A/B, single-sided. Signature side scheme: Pile It On! (07034).",
    "07046": "Bulldozer A/B, single-sided. Signature side scheme: Clear the Road (07048).",
    "07008":
      'Guard minion (Corrupt Prison Guard, Wrecker deck copy). Printed SCH is 0 (not "—"): raw scheme=0, not absent [evidence: raw; phase7 §1.12].',
    "07023": "Guard minion (Corrupt Prison Guard, Thunderball deck copy). Printed SCH is 0, same as 07008.",
    "07037": "Guard minion (Corrupt Prison Guard, Piledriver deck copy). Printed SCH is 0, same as 07008.",
    "07052": "Guard minion (Corrupt Prison Guard, Bulldozer deck copy). Printed SCH is 0, same as 07008.",
  },

  scenarios: [
    {
      id: "breakout",
      name: "Breakout",
      // Wrecker's own set holds the first (and, per printed order, primary) villain; the main scheme (Breakout)
      // is filed under the scenario's own "wrecking_crew" set, not any one villain's set (phase7-wave1.md §2.3).
      villainSetCode: "wrecker",
      mainSchemeSetCode: "wrecking_crew",
      // Insert, "Adjustable Difficulty": "The Wrecking Crew does not use other encounter sets" — no modular,
      // standard or expert sets (phase7 §1.1, §2.3).
      recommendedModularSetCodes: [],
      standardSetCodes: [],
      expertSetCodes: [],
      // "Prepare Villains and Dials": standard = each villain's A side; expert = each villain's B side. Position
      // A=1/B=2 (phase7-wave1.md §1.2, §3.15's `VillainStageRange` doc comment).
      villainStages: { standard: [1, 1], expert: [2, 2] },
      usesIdentityEncounterSets: false,
      modularSetCount: 0,
      multipleVillains: {
        villainSetCodes: ["wrecker", "thunderball", "piledriver", "bulldozer"],
        signatureSideSchemeCodes: ["07004", "07019", "07034", "07048"],
      },
      evidence:
        'Wrecking Crew insert "New Rules" ("The Active Villain", "Prepare Encounter Decks", "Signature Side Schemes", "Adjustable Difficulty" — quoted docs/phase7-wave1.md §1.1, §2.3); Breakout 1A Contents/Setup text (raw 07001a); HoH Wrecking Crew page ("Wrecking Crew - Standard (Side A), Expert (Side B), Extreme Challenge...")',
    },
  ],

  starterDecks: [],
};
