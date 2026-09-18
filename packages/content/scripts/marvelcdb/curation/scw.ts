/**
 * Scarlet Witch Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/scw.json`).
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N.
 *
 * Normalizes cleanly with no hand corrections: every card's stats, text and keywords come straight from
 * MarvelCDB's `real_text`/`real_traits` with nothing to fix (survey, 2026-09-18).
 *
 * **Starter deck not yet curated.** The Scarlet Witch Hero Pack insert's printed decklist (linked from
 * https://hallofheroeslcg.com/scarlet-witch/, "Starter Deck") is a photographed page, and this pass has no way to
 * read it; docs/phase7-wave2.md §2.1 records only the aspect (Justice) from the rulebook text, not the card list.
 * Emitting the deck as data needs that photo cross-checked against a MarvelCDB decklist, the way every wave 1
 * precon was (`curation/thor.ts` and its siblings) — left for a follow-up pass rather than guessed at here.
 */
import type { PackCuration } from "./types.ts";

export const SCW_CURATION: PackCuration = {
  packCode: "scw",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "Scarlet Witch",
    releaseDate: "2021-03-05",
    releaseDateSource: "Hall of Heroes Scarlet Witch page (https://hallofheroeslcg.com/scarlet-witch/): \"Release date: March 5, 2021\"",
  },
  outDir: "src/data/scw",
  exportPrefix: "SCW",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
