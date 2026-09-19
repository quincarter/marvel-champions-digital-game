/**
 * Angel (Warren Worthington III) Hero Pack (Cycle 7) curation.
 *
 * Normalizes cleanly with zero hand corrections (`survey.ts --pack angel`, confirmed before this file existed —
 * see docs/phase7-wave2-data.md Part 6). A three-sided identity (42001a Angel / 42001b Warren Worthington III
 * alter-ego / 42001c Archangel), the same shape as Ant-Man's Giant (`ant` 12001c) and Wasp's Giant (`wsp` 13001c)
 * — already handled by `normalize/context.ts`'s `heroBySet` fix (docs/phase7-wave2-data.md Part 1 §5). Every
 * record carries its own `imagesrc`; no artwork gap.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7), matching every
 * other zero-correction pack in this pool (`falcon`, `magneto`, …).
 */
import type { PackCuration } from "./types.ts";

export const ANGEL_CURATION: PackCuration = {
  packCode: "angel",
  cycle: { id: "cycle7", name: "Cycle 7", order: 7 },
  pack: {
    name: "Angel",
    releaseDate: "2023-09-22",
    releaseDateSource: 'Hall of Heroes Angel/Warren Worthington III page (https://hallofheroeslcg.com/angel-warren-worthington-iii/): "September 22, 2023"; cycle grouping confirmed against Hall of Heroes\' own card database navigation (https://hallofheroeslcg.com/browse/), which lists Angel alongside Psylocke, X-23 and Deadpool under Cycle 7.',
  },
  outDir: "src/data/angel",
  exportPrefix: "ANGEL",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
