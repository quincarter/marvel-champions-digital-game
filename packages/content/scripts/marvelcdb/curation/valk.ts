/**
 * Valkyrie (Brunnhilde) Hero Pack (Cycle 4) curation.
 *
 * **Curated but NOT registered for emission** — Beguiled needs a schema decision; see "Schema requests for
 * game-rules-architect" in docs/phase7-wave2-data.md. No corrections needed otherwise; this file exists to
 * document the one blocker.
 *
 * - **Beguiled (25031, attachment): NOT curatable — a schema gap.** "Attach to the ally with the highest cost
 *   without Beguiled attached" needs `SuperlativeHostPool` `"ally"` and `HostMeasure` `"cost"`, neither of which
 *   exists yet. The identical shape (by "cost") also blocks `deadpool`'s 'Pool-ized and `jubilee`'s "Lost"
 *   Child; `storm`'s Possessed needs the same pool but by `"thw"` instead. See the consolidated schema request.
 */
import type { PackCuration } from "./types.ts";

export const VALK_CURATION: PackCuration = {
  packCode: "valk",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "Valkyrie",
    releaseDate: "2022-01-21",
    releaseDateSource: 'Hall of Heroes Brunnhilde/Valkyrie page (https://hallofheroeslcg.com/brunnhilde-valkyrie/): "Release date: January 21, 2022"',
  },
  outDir: "src/data/valk",
  exportPrefix: "VALK",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
