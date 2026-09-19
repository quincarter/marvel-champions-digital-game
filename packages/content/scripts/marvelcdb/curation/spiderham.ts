/**
 * Spider-Ham (Peter Porker) Hero Pack (Cycle 5) curation.
 *
 * **Curated but NOT registered for emission** — Warrior of the Great Web needs a schema decision; see "Schema
 * requests for game-rules-architect" in docs/phase7-wave2-data.md. No corrections needed otherwise; this file
 * exists to document the one blocker.
 *
 * - **Warrior of the Great Web (30029, upgrade): NOT curatable — a schema gap.** "Attach to a character with
 *   'Spider' in its title. Max 1 per character." is a substring match on the printed title, not a trait — no
 *   existing `AttachmentHost`/`HostQualifiers` shape expresses "title contains X". See the consolidated schema
 *   request.
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
