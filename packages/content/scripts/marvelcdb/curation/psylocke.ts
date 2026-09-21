/**
 * Psylocke (Betsy Braddock) Hero Pack (Cycle 7) curation.
 *
 * - **Psi-Knife (41002a, upgrade): dash cost, confirmed.** A Permanent signature weapon (flips to Psi-Katana,
 *   `41002b`, via its own Hero Resource). MarvelCDB sends no `cost` at all on either face; confirmed against the
 *   card's own MarvelCDB listing ("Cost: —").
 * - **Psi-Knife (41002a) has no `imagesrc` at all on MarvelCDB — resolved via local art, not a curation entry.**
 *   The repo's own card scan (`assets/card-art/bundles/cards/41002a.png`) fills this in through `withLocalArt`
 *   (`scripts/marvelcdb/normalize/art.ts`, `scripts/marvelcdb/local-art.ts`), the same fallback that unblocked
 *   Jubilee's identity pair; no `imageOverrides` entry needed. Confirmed via `survey.ts --pack psylocke`
 *   (0 issues) once the local-art bundle covered `41002a`/`41002b`.
 *
 * Normalizes cleanly and is registered for emission — no remaining schema/parser gap found for this pack.
 */
import type { PackCuration } from "./types.ts";

export const PSYLOCKE_CURATION: PackCuration = {
  packCode: "psylocke",
  cycle: { id: "cycle7", name: "Cycle 7", order: 7 },
  pack: {
    name: "Psylocke",
    releaseDate: "2023-09-22",
    releaseDateSource:
      'Hall of Heroes Psylocke/Betsy Braddock page (https://hallofheroeslcg.com/psylocke-betsy-braddock/): "Release date: September 22, 2023"',
  },
  outDir: "src/data/psylocke",
  exportPrefix: "PSYLOCKE",

  corrections: [
    {
      code: "41002a",
      reason:
        'Psi-Knife is a Permanent signature weapon, flipped by its own Hero Resource rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/41002a), "Cost: —"',
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
