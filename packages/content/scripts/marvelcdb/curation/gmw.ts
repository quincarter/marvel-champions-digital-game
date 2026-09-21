/**
 * Galaxy's Most Wanted (Cycle 3) curation — a villain/scenario expansion (the Collector).
 *
 * **Curated but NOT registered for emission** — the Collector's flip-side shape needs a schema decision; see
 * "Schema requests for game-rules-architect" in docs/phase7-wave2-data.md.
 *
 * - **Milano (16142, support): dash cost, confirmed.** "Permanent. Setup. The first player controls the Milano."
 *   — enters play through Setup, never paid for. MarvelCDB sends no `cost` at all; confirmed against the card's
 *   own MarvelCDB listing ("Cost: —").
 * - **The Collector (16080a/16080b standard, 16081a/16081b expert) is NOT curatable — the same schema gap as
 *   `mts`'s Hela (see that pack's own findings and the consolidated request).** MarvelCDB's `stage` field reads
 *   "A1"/"A2" (standard mode) and "B1"/"B2" (expert mode) instead of a roman numeral: each mode is a genuine
 *   single-stage villain (16080a health 8 / 16081a health 10, matching a standard-vs-expert HP difference) that
 *   flips to a 0-HP "cannot be defeated" back face — confirmed structurally identical to Hela's shape (a
 *   `VillainStage.flipSide`-shaped back face within one stage, not a second numbered stage). Two confirmed
 *   instances of this exact shape now (`mts`, `gmw`) is real evidence the schema gap is worth prioritizing.
 */
import type { PackCuration } from "./types.ts";

export const GMW_CURATION: PackCuration = {
  packCode: "gmw",
  cycle: { id: "cycle3", name: "Cycle 3", order: 3 },
  pack: {
    name: "Galaxy's Most Wanted",
    releaseDate: "2021-04-02",
    releaseDateSource:
      'Hall of Heroes Galaxy\'s Most Wanted page (https://hallofheroeslcg.com/galaxys-most-wanted/): "Release date: April 2, 2021"',
  },
  outDir: "src/data/gmw",
  exportPrefix: "GMW",

  corrections: [
    {
      code: "16142",
      reason:
        'The Milano enters play through Setup ("Permanent. Setup. The first player controls the Milano."), never paid for from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/16142), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
