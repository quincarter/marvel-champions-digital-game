/**
 * Nova (Sam Alexander) Hero Pack curation. Cycle 5 per the Hall of Heroes card database navigation
 * (https://hallofheroeslcg.com/browse/): Nova, Ironheart, Spider-Ham, Peni Parker/SP//dr, in that release order.
 *
 * Normalizes cleanly with no hand corrections needed once the Requirement multi-icon parser fix (wave 2 schema
 * pass §6.1, docs/phase7-wave2.md) landed — the Spider-Man ally's identical Requirement text is reused here.
 */
import type { PackCuration } from "./types.ts";

export const NOVA_CURATION: PackCuration = {
  packCode: "nova",
  cycle: { id: "cycle5", name: "Cycle 5", order: 5 },
  pack: {
    name: "Nova",
    releaseDate: "2022-05-20",
    releaseDateSource:
      'Hall of Heroes Sam Alexander/Nova page (https://hallofheroeslcg.com/sam-alexander-nova/): "Release date: May 20, 2022"',
  },
  outDir: "src/data/nova",
  exportPrefix: "NOVA",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
