/**
 * Nightcrawler (Kurt Wagner) Hero Pack (Cycle 8) curation.
 *
 * Normalizes cleanly with no hand corrections needed.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7).
 */
import type { PackCuration } from "./types.ts";

export const NCRAWLER_CURATION: PackCuration = {
  packCode: "ncrawler",
  cycle: { id: "cycle8", name: "Cycle 8", order: 8 },
  pack: {
    name: "Nightcrawler",
    releaseDate: "2024-09-20",
    releaseDateSource:
      'Hall of Heroes Nightcrawler page (https://hallofheroeslcg.com/nightcrawler-kurt-wagner/): "Release date: September 20, 2024"',
  },
  outDir: "src/data/ncrawler",
  exportPrefix: "NCRAWLER",

  corrections: [],
  errata: [
    {
      code: "48012",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Rogue: "printed THW and ATK" is now "base THW and ATK". MarvelCDB (and the scan) carry the printed wording.',
      evidence:
        'RRG 1.8 p. 69, Nightcrawler Hero Pack ROGUE (#12) errata; scan 48012.jpg read, prints "printed THW and ATK"',
      currentReplace: {
        find: "adds that character's printed THW and ATK",
        replace: "adds that character's base THW and ATK",
      },
    },
    {
      code: "48037",
      version: "RRG 1.8",
      changedFields: ["boostIcons"],
      note: "Tweedledope: the star icon was removed from the boost field. The printed card shows the star; current data has none (MarvelCDB boost_star false, no Boost ability). Text is unchanged.",
      evidence:
        "RRG 1.8 p. 69, Nightcrawler Hero Pack TWEEDLEDOPE (#37) errata; scan 48037.jpg read, prints the star bottom right",
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
