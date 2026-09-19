/**
 * MojoMania (Cycle 6) curation.
 *
 * - **Longshot (39071, ally): dash cost, confirmed.** MarvelCDB sends no `cost` field at all. His own text ("Put
 *   Longshot into play under...") is a When-Revealed encounter-side ally, never paid for from hand — the same
 *   evidence standard as `rogue`/`wolv` ("Cost: —" on the card's own MarvelCDB listing).
 * - **Bandolier of Stakes (39048, attachment): resolved by a general parser fix, not curation.** Its only
 *   "where does this attach" information ("You may spend 1 resource of any type to attach this card to your
 *   identity. Otherwise, discard this card.") is a full sentence *inside* its own `When Revealed:` ability body,
 *   with the target named mid-sentence rather than as the sentence's own leading verb. `parse-text.ts` now scans
 *   for this specific "may pay to attach this card to X" idiom inside a triggered ability's own first sentence,
 *   in addition to the ordinary leading "Attach to X." shape (which already covers `valk`/`deadpool`/`storm`/
 *   `jubilee`'s similar cards). Confirmed the only instance of this exact idiom in the whole 63-pack corpus.
 * - **Three main scheme B-side images (39002a/39015a/39025a) — resolved by a general fix, not curation.**
 *   `normalize/main-schemes.ts`'s B-side image lookup (`bSideImage`) only ever consulted the *dropped bare
 *   aggregate* record's own `imagesrc` (`ctx.aggregateImage`), which is how wave 1's main schemes are shaped —
 *   but MojoMania's three main schemes have no bare aggregate record at all, even though the B-side's own
 *   *linked* record (`39002b` etc.) carries a perfectly good `imagesrc` MarvelCDB just never routed through.
 *   Given a fallback to the B-side record's own image (mirroring the A-side's existing `rb.imagesrc ?? ra.imagesrc`
 *   fallback), backward compatible — wave 1's output is unchanged since its aggregate lookup already succeeds.
 * - **Elementary, My Dear Mojo (39040) and a handful of others: a missing space between sentence-ending
 *   punctuation and the next HTML tag, fixed generally in `text.ts`** (`Surge.<b>When Revealed</b>` →
 *   `Surge. When Revealed`, only before an *opening* tag) — see docs/phase7-wave2-data.md for the full write-up;
 *   this pack's own instance (39048's own body) is what surfaced it.
 *
 * Normalizes cleanly; no schema gap remains for this pack.
 */
import type { PackCuration } from "./types.ts";

export const MOJO_CURATION: PackCuration = {
  packCode: "mojo",
  cycle: { id: "cycle6", name: "Cycle 6", order: 6 },
  pack: {
    name: "MojoMania",
    releaseDate: "2022-11-11",
    releaseDateSource: 'Hall of Heroes Mojo Mania page (https://hallofheroeslcg.com/mojo-mania/): "Release date: November 11, 2022"',
  },
  outDir: "src/data/mojo",
  exportPrefix: "MOJO",

  corrections: [
    {
      code: "39071",
      reason: "Longshot is a When-Revealed encounter-side ally (\"Put Longshot into play under...\"), never played from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap.",
      evidence: "MarvelCDB card listing (marvelcdb.com/card/39071), \"Cost: —\"",
      specialCost: "dash",
    },
  ],
  errata: [],

  scriptingNotes: {},
  // 39048 (Bandolier of Stakes) never becomes a card (see this file's header comment), so a `cardNotes` entry
  // keyed by its id would be flagged as dangling ("matches no card") — the explanation lives in the header
  // comment above instead.
  cardNotes: {},

  scenarios: [],
  starterDecks: [],
};
