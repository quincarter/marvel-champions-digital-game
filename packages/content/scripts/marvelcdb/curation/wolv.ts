/**
 * Wolverine (Logan) Hero Pack (Cycle 6) curation.
 *
 * One hand correction: Wolverine's Claws (35002) prints a dash cost — a "Permanent" signature weapon upgrade
 * exhausted for its Hero Action, not played for a resource cost. MarvelCDB sends no `cost` at all. Confirmed
 * printed dash from the card's own MarvelCDB listing ("Cost: —"), the same evidence standard used for trors'
 * Hydra Campaign upgrades (docs/phase7-wave2.md §1.3/§5.1's `specialCost` mechanism).
 *
 * Otherwise normalizes cleanly — the schema-neutral parser fixes (docs/phase7-wave2-data.md) already cover every
 * other shape this pack uses.
 *
 * **Starter deck and scenario data not curated this pass** — this pass emits the pack's cards only (data-only
 * pool, PLAN.md Phase 7 "All other packs become card data"); precon curation is a follow-up.
 */
import type { PackCuration } from "./types.ts";

export const WOLV_CURATION: PackCuration = {
  packCode: "wolv",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Wolverine",
    releaseDate: "2022-11-11",
    releaseDateSource:
      'Hall of Heroes Logan/Wolverine page (https://hallofheroeslcg.com/logan-wolverine/): "Release date: November 11, 2022"',
  },
  outDir: "src/data/wolv",
  exportPrefix: "WOLV",

  corrections: [
    {
      code: "35002",
      reason:
        'Wolverine\'s Claws is a Permanent signature weapon, exhausted for its Hero Action rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/35002), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
