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
 * **Starter deck and scenario data not curated this pass** — this pass emits the pack's cards only (data-only
 * pool, PLAN.md Phase 7 "All other packs become card data"); scenario curation is a follow-up.
 */
import type { PackCuration } from "./types.ts";

export const HOOD_CURATION: PackCuration = {
  packCode: "hood",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "The Hood",
    releaseDate: "2021-11-26",
    releaseDateSource: 'Hall of Heroes The Hood page (https://hallofheroeslcg.com/the-hood/): "Release date: November 26, 2021 (Expected)"',
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

  scenarios: [],
  starterDecks: [],
};
