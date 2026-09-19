/**
 * Deadpool (Wade Wilson) Hero Pack (Cycle 7) curation.
 *
 * - **'Pool-ized (44041, attachment): the same landed shape as `valk`'s Beguiled** (`SuperlativeHostPool "ally"`
 *   + `HostMeasure "printedCost"`, docs/phase7-wave2.md §7.1) — "Attach to the ally with the highest cost
 *   without 'Pool-ized attached" now parses automatically, including via the same "attach rule inside a
 *   `When Revealed:` ability body" parser fix `valk.ts` describes. No corrections needed; normalizes cleanly.
 */
import type { PackCuration } from "./types.ts";

export const DEADPOOL_CURATION: PackCuration = {
  packCode: "deadpool",
  cycle: { id: "cycle7", name: "Cycle 7", order: 7 },
  pack: {
    name: "Deadpool",
    releaseDate: "2023-11-17",
    releaseDateSource: 'Hall of Heroes Wade Wilson/Deadpool page (https://hallofheroeslcg.com/deadpool/): "Release date: November 17, 2023"',
  },
  outDir: "src/data/deadpool",
  exportPrefix: "DEADPOOL",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
