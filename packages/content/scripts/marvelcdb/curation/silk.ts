/**
 * Silk (Cindy Moon) Hero Pack curation. Cycle 9 per the Hall of Heroes card database navigation
 * (https://hallofheroeslcg.com/browse/): Black Panther/Shuri, Silk, Falcon, Winter Soldier, Trickster Takeover.
 *
 * Normalizes cleanly with no hand corrections needed once the Requirement multi-icon parser fix (wave 2 schema
 * pass §6.1, docs/phase7-wave2.md) landed.
 */
import type { PackCuration } from "./types.ts";

export const SILK_CURATION: PackCuration = {
  packCode: "silk",
  cycle: { id: "cycle9", name: "Cycle 9", order: 9 },
  pack: {
    name: "Silk",
    releaseDate: "2025-05-02",
    releaseDateSource:
      'Hall of Heroes Silk/Cindy Moon page (https://hallofheroeslcg.com/silk-cindy-moon/): "Release date: May 2, 2025"',
  },
  outDir: "src/data/silk",
  exportPrefix: "SILK",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
