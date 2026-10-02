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
  cycle: { id: "cycle6", name: "Mutant Genesis", order: 6 },
  pack: {
    name: "MojoMania",
    releaseDate: "2022-11-11",
    releaseDateSource:
      'Hall of Heroes Mojo Mania page (https://hallofheroeslcg.com/mojo-mania/): "Release date: November 11, 2022"',
  },
  outDir: "src/data/mojo",
  exportPrefix: "MOJO",

  corrections: [
    {
      code: "39071",
      reason:
        'Longshot is a When-Revealed encounter-side ally ("Put Longshot into play under..."), never played from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 "Dash (Value)", p. 15), not a data gap.',
      evidence: 'MarvelCDB card listing (marvelcdb.com/card/39071), "Cost: —"',
      specialCost: "dash",
    },
    {
      code: "39016",
      reason:
        'The Search for Spiral prints "Forced Response" on its first trigger; MarvelCDB sends "Forced Interrupt". The after-the-last-threat-is-removed wording is a response window, so this is a transcription error, not errata.',
      evidence:
        'Card scan assets/card-art/bundles/cards/39016.png: "Forced Response: After the last threat is removed from here, the player who removed that threat reveals the top card of the show deck and places 3[per_hero] threat here."',
      textReplace: {
        find: "Forced Interrupt: After the last threat",
        replace: "Forced Response: After the last threat",
      },
    },
    {
      code: "39054",
      reason: 'Avalanche 9.0 prints "deal 1 damage to that character"; MarvelCDB sends "this character".',
      evidence:
        'Card scan assets/card-art/bundles/cards/39054.png: "Forced Response: After Avalanche 9.0 engages you, exhaust a character you control and deal 1 damage to that character."',
      textReplace: { find: "deal 1 damage to this character", replace: "deal 1 damage to that character" },
    },
  ],
  errata: [
    {
      code: "39016",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: "The Search for Spiral: the Hero Action's 2 damage is a cost (cost arrow added). MarvelCDB carries the current wording; the print has a period instead of the arrow.",
      evidence:
        'RRG 1.8 p. 69, MojoMania errata (#16): Should read "Hero Action: Take 2 damage → remove 3 threat from here." (Added cost arrow.) Scan assets/card-art/bundles/cards/39016.png prints "Take 2 damage. Remove 3 threat from here."',
      printedReplace: {
        find: "Take 2 damage → remove 3 threat from here.",
        replace: "Take 2 damage. Remove 3 threat from here.",
      },
    },
    {
      code: "39045",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Fetch Quest: "for free" became "ignoring its resource cost" (a card with a requirement cannot be played this way). MarvelCDB carries the current wording.',
      evidence:
        'RRG 1.8 p. 69, MojoMania errata (#45): "... and play that card, ignoring its resource cost." (Replaced "for free" with "ignoring its resource cost".) Scan assets/card-art/bundles/cards/39045.png prints "play that card for free."',
      printedReplace: {
        find: "play that card, ignoring its resource cost.",
        replace: "play that card for free.",
      },
    },
  ],

  // MaGog 39001a/39001b are the standard and expert versions (insert p. 8), each its own one-stage card; Spiral's
  // MarvelCDB top-level record 39012a is her ESCAPED face, the one she starts on (insert p. 11; scan 39012a.png
  // "ESCAPED. MYSTIC.", collector number 12A), so it is side A and the hidden 39012b CORNERED is side B.
  separateVillainVersions: ["magog"],
  villainFrontIsSideA: ["spiral"],

  scriptingNotes: {},
  // 39048 (Bandolier of Stakes) never becomes a card (see this file's header comment), so a `cardNotes` entry
  // keyed by its id would be flagged as dangling ("matches no card") — the explanation lives in the header
  // comment above instead.
  cardNotes: {
    "39012a":
      'Spiral\'s ESCAPED ATK prints "★" (scan 39012a.png), emitted as a dashed ATK (0) on all three ESCAPED stages: her own Forced Interrupt ("When Spiral would attack, she schemes instead") replaces every attack before the dashed-stat skip applies (docs/phase7-wave6.md §7.7). CORNERED prints ATK 1/2/3.',
  },

  scenarios: [],
  starterDecks: [],
};
