/**
 * Cyclops (Scott Summers) Hero Pack (Cycle 6) curation.
 *
 * Normalizes cleanly with no hand corrections needed — the schema-neutral parser fixes landed across all packs
 * (docs/phase7-wave2-data.md) already cover every shape this pack uses.
 *
 * **Starter deck and scenario data not curated this pass** — this pass emits the pack's cards only (data-only
 * pool, PLAN.md Phase 7 "All other packs become card data"); precon/scenario curation is a follow-up.
 */
import type { PackCuration } from "./types.ts";

export const CYCLOPS_CURATION: PackCuration = {
  packCode: "cyclops",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "Cyclops",
    releaseDate: "2022-09-30",
    releaseDateSource: "Hall of Heroes Cyclops page (https://hallofheroeslcg.com/scott-summers-cyclops/): \"Release date: September 30, 2022\"",
  },
  outDir: "src/data/cyclops",
  exportPrefix: "CYCLOPS",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
