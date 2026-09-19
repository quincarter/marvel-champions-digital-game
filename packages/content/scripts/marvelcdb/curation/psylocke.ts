/**
 * Psylocke (Betsy Braddock) Hero Pack (Cycle 7) curation.
 *
 * **Curated but NOT registered for emission** — Psi-Knife's own artwork is still missing after the dash-cost fix
 * below; no second source was found this pass (see below).
 *
 * - **Psi-Knife (41002a, upgrade): dash cost, confirmed.** A Permanent signature weapon (flips to Psi-Katana,
 *   `41002b`, via its own Hero Resource). MarvelCDB sends no `cost` at all on either face; confirmed against the
 *   card's own MarvelCDB listing ("Cost: —").
 * - **Psi-Knife (41002a) has no `imagesrc` at all on MarvelCDB — not yet resolved.** Unlike `ironheart`/`qsv`,
 *   no second-source scan was located and confirmed for this specific face this pass (Hall of Heroes' own
 *   Psylocke release-page gallery filenames are generic and weren't individually verified against this card the
 *   way `ironheart.ts`'s six identity faces were — not attempted this pass to keep moving through the gap
 *   matrix). `imageOverrides` is the right mechanism once a source is confirmed.
 */
import type { PackCuration } from "./types.ts";

export const PSYLOCKE_CURATION: PackCuration = {
  packCode: "psylocke",
  cycle: { id: "cycle7", name: "Cycle 7", order: 7 },
  pack: {
    name: "Psylocke",
    releaseDate: "2023-09-22",
    releaseDateSource: 'Hall of Heroes Psylocke/Betsy Braddock page (https://hallofheroeslcg.com/psylocke-betsy-braddock/): "Release date: September 22, 2023"',
  },
  outDir: "src/data/psylocke",
  exportPrefix: "PSYLOCKE",

  corrections: [
    {
      code: "41002a",
      reason: "Psi-Knife is a Permanent signature weapon, flipped by its own Hero Resource rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/41002a), \"Cost: —\"",
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
