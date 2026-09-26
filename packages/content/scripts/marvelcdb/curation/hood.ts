/**
 * The Hood (Cycle 4) curation — a villain/scenario expansion, not a hero pack (no `hero`/`hero_identity` type_code
 * records at all in raw: 3 villain, 6 main_scheme, 11 attachment, 20 minion, 10 side_scheme, 18 treachery, 6
 * environment).
 *
 * Normalizes cleanly with no hand corrections needed once `normalize/flatten.ts`'s aggregate-quantity check
 * stopped double-counting a double-sided card's two faces as two printed copies (general fix, not Hood-specific
 * — see that file's own comment; also unblocks the same shape in `mts`'s Legions of Hel villains, not otherwise
 * touched this pass). Formidable Foe (24049a/24049b) is one physical double-sided environment card, and MarvelCDB's
 * bare aggregate record `24049` (quantity 1) was being compared against the *sum* of both faces' `quantity`
 * (1 + 1 = 2) instead of the one physical card it actually represents.
 *
 * **The Hood scenario record** (docs/phase7-wave4.md §1.12, §2.3): Making Connections → Promised Prosperity →
 * Crime State, villain 24001 (I) / 24002 (II) / 24003 (III), main scheme 24004/24005/24006. Standard uses stages
 * I-II, expert II-III — the same shape as every other Core-style scenario, so `villainStages` follows suit with no
 * curated evidence beyond the raw records' own stage labels. `setAsideModularSetCount: 7` is Making Connections
 * 1A's "Choose 7 modular encounter sets and set them aside (you may choose randomly). Choose 1 of those sets at
 * random, then shuffle it into the encounter deck." (§3.18, not yet built, so this scenario stays data-only per
 * §1's own status note). `standardSetCodes`/`expertSetCodes` are Core's plain Standard/Expert (`docs/phase7-wave4.md`
 * §4 Q5: Standard II/Expert II are never chosen until The Hood's insert, not in the repo, is read). No modular set
 * is "recommended" (all nine are among the seven set aside at setup, chosen randomly), so
 * `recommendedModularSetCodes` is empty and `modularSetCount` is 0.
 *
 * **Starter deck not curated this pass** — The Hood is a scenario pack with no player cards (PLAN.md Phase 7 "All
 * other packs become card data").
 */
import type { PackCuration } from "./types.ts";

export const HOOD_CURATION: PackCuration = {
  packCode: "hood",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "The Hood",
    releaseDate: "2021-11-26",
    releaseDateSource:
      'Hall of Heroes The Hood page (https://hallofheroeslcg.com/the-hood/): "Release date: November 26, 2021 (Expected)"',
  },
  outDir: "src/data/hood",
  exportPrefix: "HOOD",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "24049a":
      "Formidable Foe is a double-sided environment card (24049a/24049b, one physical card). MarvelCDB's bare " +
      "aggregate record 24049 (quantity 1) is dropped as a duplicate, same as every aggregate — flatten.ts's " +
      "quantity check now compares against one face's quantity, not both faces summed (see that file).",
  },

  scenarios: [
    {
      id: "the-hood",
      name: "The Hood",
      villainSetCode: "the_hood",
      recommendedModularSetCodes: [],
      standardSetCodes: ["standard"],
      expertSetCodes: ["expert"],
      villainStages: { standard: [1, 2], expert: [2, 3] },
      modularSetCount: 0,
      setAsideModularSetCount: 7,
      evidence:
        "MC21 has no rulebook for The Hood in the repo; villain/main-scheme stage numbers and the seven-set-" +
        "aside/one-shuffled-in setup are the raw MarvelCDB records (24001-24006, standard I-II / expert II-III, " +
        "the pack's own villain/main_scheme stage labels) plus Making Connections 1A's own printed text " +
        "(docs/phase7-wave4.md §1.12, §2.3, §3.18).",
    },
  ],
  starterDecks: [],
};
