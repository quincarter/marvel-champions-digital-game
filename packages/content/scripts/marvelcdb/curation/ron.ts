/**
 * Ronan the Accuser Print and Play modular set curation.
 *
 * **Not a retail product** — a fan-facing Print and Play modular encounter set released for Gen Con Online 2020
 * (Hall of Heroes: https://hallofheroeslcg.com/ronan-the-accuser/, "Release date: August 2, 2020 (Gen Con
 * Online)"), not part of any numbered cycle in the Hall of Heroes card database navigation
 * (https://hallofheroeslcg.com/browse/). Given its own `cycle.id` ("promo") rather than folded into a numbered
 * cycle, so it is not mistaken for an official cycle product; flagged here rather than guessed into one.
 *
 * Five encounter cards (Ronan the Accuser as a minion, not a villain; a side scheme, an attachment, two
 * treacheries), all in the `kree_fanatic` MarvelCDB set. Normalizes cleanly with no hand corrections needed.
 */
import type { PackCuration } from "./types.ts";

export const RON_CURATION: PackCuration = {
  packCode: "ron",
  cycle: { id: "promo", name: "Print and Play / Promotional", order: 0 },
  pack: {
    name: "Ronan the Accuser Print and Play Modular Set",
    releaseDate: "2020-08-02",
    releaseDateSource:
      'Hall of Heroes Ronan the Accuser page (https://hallofheroeslcg.com/ronan-the-accuser/): "Release date: August 2, 2020 (Gen Con Online)"',
  },
  outDir: "src/data/ron",
  exportPrefix: "RON",

  corrections: [],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
