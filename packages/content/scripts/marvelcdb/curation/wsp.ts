/**
 * Wasp Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/wsp.json`).
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N.
 *
 * Normalizes cleanly with no hand corrections (survey, 2026-09-18): Nadia Van Dyne/Wasp's Giant inside face
 * (13001c) folds into `additionalHeroForms` the same way Ant-Man's does (docs/phase7-wave2.md §1.1).
 *
 * **Starter deck not yet curated,** for the same reason as `curation/scw.ts`: the Wasp insert's printed decklist
 * is a photographed page (https://hallofheroeslcg.com/wasp/, "Starter Deck"), and docs/phase7-wave2.md §2.1
 * records only the aspect (Aggression), not the card list. Left for a follow-up pass.
 */
import type { PackCuration } from "./types.ts";

export const WSP_CURATION: PackCuration = {
  packCode: "wsp",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "Wasp",
    releaseDate: "2021-01-22",
    releaseDateSource: "Hall of Heroes Wasp page (https://hallofheroeslcg.com/wasp/): \"Release date: January 22, 2021\"",
  },
  outDir: "src/data/wsp",
  exportPrefix: "WSP",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
