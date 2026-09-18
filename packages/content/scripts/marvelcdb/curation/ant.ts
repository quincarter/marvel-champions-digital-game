/**
 * Ant-Man Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/ant.json`).
 * - "phase7 wave2 §N": docs/phase7-wave2.md section N.
 *
 * Normalizes cleanly with no hand corrections (survey, 2026-09-18), once the schema/parser support docs/
 * phase7-wave2.md §1.1 landed: Scott Lang/Ant-Man's Giant inside face (12001c) folds into `additionalHeroForms`
 * instead of erroring as an unlinked hero record.
 *
 * **Starter deck not yet curated,** for the same reason as `curation/scw.ts`: the Ant-Man insert's printed
 * decklist is a photographed page (https://hallofheroeslcg.com/ant-man/, "Starter Deck"), and docs/
 * phase7-wave2.md §2.1 records only the aspect (Leadership), not the card list. Left for a follow-up pass.
 */
import type { PackCuration } from "./types.ts";

export const ANT_CURATION: PackCuration = {
  packCode: "ant",
  cycle: { id: "cycle1", name: "The Rise of Red Skull", order: 2 },
  pack: {
    name: "Ant-Man",
    releaseDate: "2020-11-06",
    releaseDateSource:
      "Hall of Heroes Ant-Man page (https://hallofheroeslcg.com/ant-man/): \"Release date: November 6, 2020 (Originally September, 2020)\" — the wide release date is used, matching the raw cache's own pack metadata.",
  },
  outDir: "src/data/ant",
  exportPrefix: "ANT",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
