/**
 * X-23 (Laura Kinney) Hero Pack (Cycle 7) curation.
 *
 * **Curated but NOT registered for emission** — 43012 needs a schema decision; see "Schema requests for
 * game-rules-architect" in docs/phase7-wave2-data.md.
 *
 * - **X-23's Claws (43002, upgrade): dash cost, confirmed.** A Permanent signature weapon, exhausted for its own
 *   Hero Action rather than played for a resource cost. MarvelCDB sends no `cost` at all; confirmed against the
 *   card's own MarvelCDB listing ("Cost: —").
 * - **43012 (attachment): NOT curatable — a schema gap.** "Attach to an enemy that X-23 or Honey Badger attacked
 *   this turn" is a temporal condition (which enemy was attacked, and when), not a static qualifier any existing
 *   `AttachmentHost` kind can express. See the consolidated schema request.
 */
import type { PackCuration } from "./types.ts";

export const X23_CURATION: PackCuration = {
  packCode: "x23",
  cycle: { id: "cycle7", name: "Cycle 7", order: 7 },
  pack: {
    name: "X-23",
    releaseDate: "2023-11-17",
    releaseDateSource: 'Hall of Heroes X-23/Laura Kinney page (https://hallofheroeslcg.com/x-23-laura-kinney/): "Release date: November 17, 2023"',
  },
  outDir: "src/data/x23",
  exportPrefix: "X23",

  corrections: [
    {
      code: "43002",
      reason: "X-23's Claws is a Permanent signature weapon, exhausted for its own Hero Action rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/43002), \"Cost: —\"",
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
