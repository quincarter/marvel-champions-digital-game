/**
 * Wonder Man (Simon Williams) Hero Pack (Cycle 10) curation.
 *
 * - **Ionic Physiology (58002, upgrade) and Cameo (58031, support): dash cost, confirmed.** Ionic Physiology is
 *   Permanent, entering play by its own text; Cameo is a `Setup:` search-and-attach support, never played for a
 *   resource cost. Both send no `cost` at all on MarvelCDB; both confirmed against their own MarvelCDB listing
 *   ("Cost: —").
 * - **Coordinated Effort (58032, upgrade): `AttachmentHost { kind: "encounterCard" }`**, landed by
 *   `game-rules-architect` (docs/phase7-wave2.md §7.2) in response to this pipeline's schema request — "Attach
 *   to an encounter card in play. Max 1 per encounter card." parses automatically once the request landed; no
 *   further curation needed. Normalizes cleanly.
 */
import type { PackCuration } from "./types.ts";

export const WONDER_MAN_CURATION: PackCuration = {
  packCode: "wonder_man",
  cycle: { id: "cycle10", name: "Cycle 10", order: 10 },
  pack: {
    name: "Wonder Man",
    releaseDate: "2026-02-20",
    releaseDateSource: 'Hall of Heroes Simon Williams/Wonder Man page (https://hallofheroeslcg.com/simon-williams-wonder-man/): "Release date: February 20, 2026"',
  },
  outDir: "src/data/wonder_man",
  exportPrefix: "WONDER_MAN",

  corrections: [
    {
      code: "58002",
      reason: "Ionic Physiology is Permanent, entering play through its own text rather than being paid for from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/58002), \"Cost: —\"",
      specialCost: "dash",
    },
    {
      code: "58031",
      reason: "Cameo is a Setup: search-and-attach support, never played for a resource cost: raw sends no `cost` at all — same reasoning as 58002.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/58031), \"Cost: —\"",
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
