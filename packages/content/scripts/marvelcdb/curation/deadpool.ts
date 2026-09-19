/**
 * Deadpool (Wade Wilson) Hero Pack (Cycle 7) curation.
 *
 * **Curated but NOT registered for emission** — 'Pool-ized needs a schema decision; see "Schema requests for
 * game-rules-architect" in docs/phase7-wave2-data.md. No corrections needed otherwise; this file exists to
 * document the one blocker.
 *
 * - **'Pool-ized (44041, attachment): NOT curatable — the same schema gap as `valk`'s Beguiled.** "Attach to the
 *   ally with the highest cost without 'Pool-ized attached" needs `SuperlativeHostPool` `"ally"` and
 *   `HostMeasure` `"cost"`. See the consolidated schema request.
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
