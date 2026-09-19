/**
 * MojoMania (Cycle 6) curation.
 *
 * **Curated but NOT registered for emission** (`ingest-marvelcdb.ts`'s `REGISTERED_CURATIONS`) — one card still
 * blocks a clean normalize. See `docs/phase7-wave2-data.md`'s "Schema requests for game-rules-architect" /
 * parser-gap log for the precise blocker; everything else below is confirmed and ready to register the moment
 * that one card is resolved.
 *
 * - **Longshot (39071, ally): dash cost, confirmed.** MarvelCDB sends no `cost` field at all. His own text ("Put
 *   Longshot into play under...") is a When-Revealed encounter-side ally, never paid for from hand — the same
 *   evidence standard as `rogue`/`wolv` ("Cost: —" on the card's own MarvelCDB listing).
 * - **Bandolier of Stakes (39048, attachment): NOT curatable this pass — a parser-architecture gap, not a
 *   schema gap.** Its only "where does this attach" information ("You may spend 1 resource of any type to
 *   attach this card to your identity. Otherwise, discard this card.") is a full sentence *inside* its own
 *   `When Revealed:` ability body, not a standalone `Attach to X.` sentence in the card's preamble. The
 *   `parseCardText` per-sentence attach-rule scan (`parse-text.ts`) only inspects the preamble before any
 *   trigger header — it never looks inside a triggered ability's own body at all, by design (every other
 *   attachment in the whole 63-pack corpus prints its attach rule before any trigger header). The target host
 *   itself needs no new schema shape (`{ kind: "yourIdentity" }` already exists) — this is purely about *where*
 *   the parser looks for it. Confirmed as the only instance of this shape in the whole card pool (grepped every
 *   pack's raw text for the "You may spend ... to attach this card to ... Otherwise, discard this card." idiom).
 *   Deferred rather than special-cased for one card; flagged for whoever next touches `parseCardText`'s
 *   ability-body scanning.
 * - **Three main scheme B-side images (39002a/39015a/39025a) — resolved by a general fix, not curation.**
 *   `normalize/main-schemes.ts`'s B-side image lookup (`bSideImage`) only ever consulted the *dropped bare
 *   aggregate* record's own `imagesrc` (`ctx.aggregateImage`), which is how wave 1's main schemes are shaped —
 *   but MojoMania's three main schemes have no bare aggregate record at all, even though the B-side's own
 *   *linked* record (`39002b` etc.) carries a perfectly good `imagesrc` MarvelCDB just never routed through.
 *   Given a fallback to the B-side record's own image (mirroring the A-side's existing `rb.imagesrc ?? ra.imagesrc`
 *   fallback), backward compatible — wave 1's output is unchanged since its aggregate lookup already succeeds.
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
