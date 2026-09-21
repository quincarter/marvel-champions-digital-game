/**
 * Valkyrie (Brunnhilde) Hero Pack (Cycle 4) curation.
 *
 * - **Beguiled (25031, attachment): `SuperlativeHostPool "ally"` + `HostMeasure "printedCost"`**, landed by
 *   `game-rules-architect` (docs/phase7-wave2.md §7.1) — "Attach to the ally with the highest cost without
 *   Beguiled attached" now parses to `{ kind: "superlative", among: "ally", order: "highest", measure:
 *   "printedCost", withoutAttachmentNamed: "Beguiled" }`. Also needed the parser to look for an "Attach to X."
 *   sentence inside a `When Revealed:` ability's own body, not just the card's preamble (`parse-text.ts`'s
 *   general fix, `docs/phase7-wave2-data.md`) — this card's attach rule is the ability's own opening sentence,
 *   not a separate preamble line. No corrections needed; normalizes cleanly.
 */
import type { PackCuration } from "./types.ts";

export const VALK_CURATION: PackCuration = {
  packCode: "valk",
  cycle: { id: "cycle4", name: "Cycle 4", order: 4 },
  pack: {
    name: "Valkyrie",
    releaseDate: "2022-01-21",
    releaseDateSource:
      'Hall of Heroes Brunnhilde/Valkyrie page (https://hallofheroeslcg.com/brunnhilde-valkyrie/): "Release date: January 21, 2022"',
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
