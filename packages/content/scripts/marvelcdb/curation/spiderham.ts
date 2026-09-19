/**
 * Spider-Ham (Peter Porker) Hero Pack (Cycle 5) curation.
 *
 * - **Warrior of the Great Web (30029, upgrade): `HostQualifiers.titleContains`**, landed by
 *   `game-rules-architect` (docs/phase7-wave2.md §7.3) — "Attach to a character with 'Spider' in its title. Max
 *   1 per character." now parses to `{ kind: "qualified", category: "character", titleContains: "Spider" }` +
 *   `playRestrictions.maxPerHost: 1`. No corrections needed; normalizes cleanly.
 */
import type { PackCuration } from "./types.ts";

export const SPIDERHAM_CURATION: PackCuration = {
  packCode: "spiderham",
  cycle: { id: "cycle5", name: "Cycle 5", order: 5 },
  pack: {
    name: "Spider-Ham",
    releaseDate: "2022-07-15",
    releaseDateSource: 'Hall of Heroes Spider-Ham/Peter Porker page (https://hallofheroeslcg.com/spider-ham-peter-porker/): "Release date: July 15, 2022"',
  },
  outDir: "src/data/spiderham",
  exportPrefix: "SPIDERHAM",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
