/**
 * Rogue (Anna Marie) Hero Pack (Cycle 6) curation.
 *
 * One hand correction: Touched (38002) prints a dash cost — it is a "signature" upgrade whose text ("If Touched
 * is attached to a: ...") implies it enters play through Rogue's own hero-kit ability, not paid for from hand.
 * MarvelCDB sends no `cost` at all. Confirmed printed dash from the card's own MarvelCDB listing ("Cost: —"), the
 * same evidence standard used for trors' Hydra Campaign upgrades (docs/phase7-wave2.md §1.3/§5.1's `specialCost`
 * mechanism).
 *
 * Otherwise normalizes cleanly — the schema-neutral parser fixes (docs/phase7-wave2-data.md) already cover every
 * other shape this pack uses.
 *
 * **Starter deck and scenario data not curated this pass** — this pass emits the pack's cards only (data-only
 * pool, PLAN.md Phase 7 "All other packs become card data"); precon curation is a follow-up.
 */
import type { PackCuration } from "./types.ts";

export const ROGUE_CURATION: PackCuration = {
  packCode: "rogue",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Rogue",
    releaseDate: "2023-02-24",
    releaseDateSource:
      'Hall of Heroes Rogue/Anna Marie page (https://hallofheroeslcg.com/rogue-anna-marie/): "Release date: February 24, 2023"',
  },
  outDir: "src/data/rogue",
  exportPrefix: "ROGUE",

  corrections: [
    {
      code: "38002",
      reason:
        'Touched is a signature upgrade attached by Rogue\'s own hero-kit text, not played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/38002), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
