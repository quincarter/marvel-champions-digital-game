/**
 * X-23 (Laura Kinney) Hero Pack (Cycle 7) curation.
 *
 * - **X-23's Claws (43002, upgrade): dash cost, confirmed.** A Permanent signature weapon, exhausted for its own
 *   Hero Action rather than played for a resource cost. MarvelCDB sends no `cost` at all; confirmed against the
 *   card's own MarvelCDB listing ("Cost: —").
 * - **Puncture Wound (43012, attachment): `HostQualifiers.attackedThisTurnBy`**, landed by
 *   `game-rules-architect` (docs/phase7-wave2.md §7.4) — "Attach to an enemy that X-23 or Honey Badger attacked
 *   this turn" now parses to `{ kind: "qualified", category: "enemy", attackedThisTurnBy: ["X-23", "Honey
 *   Badger"] }`. **Data only, per the architect's own note:** the engine records no per-turn attack history yet,
 *   so this qualifier resolves to no legal host until it does — 43012 carries correct data but must not be
 *   marked playable before that engine primitive lands (docs/phase7-wave1.md §3.1).
 */
import type { PackCuration } from "./types.ts";

export const X23_CURATION: PackCuration = {
  packCode: "x23",
  cycle: { id: "cycle7", name: "Cycle 7", order: 7 },
  pack: {
    name: "X-23",
    releaseDate: "2023-11-17",
    releaseDateSource:
      'Hall of Heroes X-23/Laura Kinney page (https://hallofheroeslcg.com/x-23-laura-kinney/): "Release date: November 17, 2023"',
  },
  outDir: "src/data/x23",
  exportPrefix: "X23",

  corrections: [
    {
      code: "43002",
      reason:
        'X-23\'s Claws is a Permanent signature weapon, exhausted for its own Hero Action rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/43002), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {
    "43012":
      "attackedThisTurnBy is data only (docs/phase7-wave2.md §7.4) — the engine has no per-turn attack history yet, so this card resolves to no legal host and must not be marked playable until that primitive lands.",
  },

  scenarios: [],
  starterDecks: [],
};
