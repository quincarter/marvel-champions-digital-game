/**
 * Jubilee (Jubilation Lee) Hero Pack (Cycle 8) curation.
 *
 * Normalizes cleanly with zero hand corrections (`survey.ts --pack jubilee`; confirmed before this file existed
 * — same shape as `angel`/`falcon`/`magneto` and every other zero-correction pack in this pool). Every record
 * carries its own `imagesrc` except Jubilee's own identity pair (47001a/b), which fall back to the repo's local
 * card scans via `withLocalArt` (`assets/card-art/bundles/cards/47001a.png`, `47001b.png`) — no artwork gap.
 *
 * **Starter deck and scenario data not curated this pass** — data-only pool (PLAN.md Phase 7), matching every
 * other zero-correction pack in this pool (`falcon`, `magneto`, …).
 */
import type { PackCuration } from "./types.ts";

export const JUBILEE_CURATION: PackCuration = {
  packCode: "jubilee",
  cycle: { id: "cycle8", name: "Cycle 8", order: 8 },
  pack: {
    name: "Jubilee",
    releaseDate: "2024-07-19",
    releaseDateSource: 'Hall of Heroes Jubilee/Jubilation Lee page (https://hallofheroeslcg.com/jubilee-jubilation-lee/): "Release date: July 19, 2024"; cycle grouping confirmed against Hall of Heroes\' own card database navigation (https://hallofheroeslcg.com/browse/), which lists Jubilee alongside Iceman, Nightcrawler and Magneto under Cycle 8.',
  },
  outDir: "src/data/jubilee",
  exportPrefix: "JUBILEE",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
