/**
 * SP//dr (Peni Parker) Hero Pack curation. Evidence abbreviations:
 * - "raw": the pack's own cached raw record (`packages/content/raw/marvelcdb/spdr.json`).
 * - "insert": the SP//dr Hero Pack insert, `https://hallofheroeslcg.com/wp-content/uploads/2022/07/z2.jpg`, "New
 *   Rule: Separated Identity Card" (fetched 2026-09-19, viewed directly, not stored — CLAUDE.md "Content & IP
 *   boundaries").
 * - "gallery": Hall of Heroes' SP//dr release page (https://hallofheroeslcg.com/peni-parker-sp-dr/) own card scan
 *   gallery, `https://hallofheroeslcg.com/wp-content/uploads/2022/09/<file>.jpg` (fetched 2026-09-19, viewed
 *   directly, not stored).
 *
 * **Separated identity, schema pass §6.10 (docs/phase7-wave2.md).** SP//dr's identity is split across two
 * physical cards: the SP//dr Suit (ACTIVE hero side `31001a`, linked to its own INACTIVE support side `31001b`)
 * and Peni Parker (alter-ego side, linked to her own SP//dr upgrade side). MarvelCDB's cache has **no record at
 * all** for Peni Parker's card — no `31002` anywhere in `spdr.json`, confirmed by grep — which is why `31001a`'s
 * `linked_card` points at a `support` record instead of an `alter_ego` one (the survey's "hero without a linked
 * alter-ego" / "unhandled type hero" / "hero card in set spdr with no identity" ×11 — every one of those last 11
 * is a hero-kit card whose `aspect: hero:31001a` can't resolve without a real identity for the `spdr` set, so
 * fixing this one card fixes all of them).
 *
 * Found a second source with Peni Parker's own two faces: Hall of Heroes' SP//dr release-page gallery hosts full
 * card scans (not just the rulebook insert) at `.../2022/09/s0a.jpg` (Peni Parker, alter-ego, collector mark
 * "2A") and `.../2022/09/s2.jpg` (the SP//dr upgrade side, collector mark "SP//DR (2/17)", "2B"). Both viewed
 * directly and transcribed verbatim below — text, traits, hand size, REC, all cross-checked against the printed
 * card image (font, layout, collector mark all present and legible). `31001b`'s own scan (`.../2022/09/s1.jpg`,
 * "SP//DR (1/17)", "1B") independently confirms MarvelCDB's `31001b` record matches the print (both already emit
 * from the real record, not curated) — including that MarvelCDB's `real_text` already reflects the RRG 1.6 errata
 * noted on the raw record (`errata: "Counters and attachments now move to Peni Parker, instead of the reverse.
 * (RRG 1.6)"`): the scan's own text is the *pre-errata* wording ("moving all counters on her ... to this card"),
 * the reverse direction of MarvelCDB's current `real_text` ("moving all counters on this card ... to her"). No
 * `errata` correction is added for `31001b` here since MarvelCDB's cached text is already the current wording and
 * ingestion reads `real_text` as current by design (`normalize.ts`'s header comment) — flagged for whoever adds
 * the pre-errata `printed` text for `31001b` later (not attempted this pass: the physical print itself was never
 * independently re-verified beyond this one gallery scan, and doing it properly needs the errata's own citation,
 * which is out of scope for unblocking this pack).
 *
 * No corrections/errata beyond the above; the rest of the pack (35 other cards) normalizes cleanly once the
 * identity resolves.
 */
import type { PackCuration } from "./types.ts";

export const SPDR_CURATION: PackCuration = {
  packCode: "spdr",
  cycle: { id: "cycle5", name: "Cycle 5", order: 5 },
  pack: {
    name: "SP//dr",
    releaseDate: "2022-07-15",
    releaseDateSource:
      'Hall of Heroes Peni Parker/SP//dr page (https://hallofheroeslcg.com/peni-parker-sp-dr/): "Release date: July 15, 2022"',
  },
  outDir: "src/data/spdr",
  exportPrefix: "SPDR",

  corrections: [],
  errata: [
    // docs/phase7-wave5.md §1.9, RRG 1.8 p. 68: MarvelCDB's own `errata` field is unset for this record, and its
    // text still reads the pre-errata "engaged hero"/"that hero" — the printed wording is reconstructed by
    // reversing the errata (`printedReplace`), the ordinary direction every other `Errata` entry in this pipeline
    // uses.
    {
      code: "31027",
      version: "RRG 1.8",
      changedFields: ["text"],
      note: 'Changed "engaged hero" to "engaged player" and "that hero" to "that player\'s hero".',
      evidence:
        'RRG 1.8 p. 68, "M.O.R.B.I.U.S. (#27)": "Should read: \'Forced Response: After the engaged player ' +
        "generates any number of resources, deal an equal amount of damage to that player's hero.'\" MarvelCDB's " +
        "own `real_text` still has the pre-errata wording, with no `errata` field set.",
      // MarvelCDB's own text lags the errata (still the printed wording) rather than leading it, the same shape
      // wave 1's Black Widow 08001a/Synth-Suit 08009 used (`Errata`'s own doc comment) — `currentReplace` derives
      // the up-to-date wording forward from the (already-printed) source text.
      currentReplace: {
        find: "After the engaged hero generates any number of resources, deal an equal amount of damage to that hero.",
        replace:
          "After the engaged player generates any number of resources, deal an equal amount of damage to that player's hero.",
      },
    },
  ],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  // Precon (starter deck) transcription for this pack is owned by a separate image-collection pass
  // (docs/phase7-wave5-sources.md §5, §7.1) — left empty here.
  starterDecks: [],

  separatedIdentities: {
    "31001a": {
      alterEgoCardNumber: "31002",
      alterEgo: {
        name: "Peni Parker",
        traits: ["Civilian"],
        handSize: 4,
        rec: 4,
        text:
          "Psychogenetic Compatibility — Setup: Put SP//dr Suit into play, INACTIVE side faceup.\n" +
          "Maintenance — Alter-Ego Action: Exhaust SP//dr Suit → draw 2 cards.",
        image: "https://hallofheroeslcg.com/wp-content/uploads/2022/09/s0a.jpg",
      },
      alterEgoOtherSide: {
        name: "SP//dr",
        traits: ["Interface", "Pilot"],
        text:
          "Permanent. This card's printed text box cannot be treated as if it were blank.\n" +
          "Suit Up! — Forced Interrupt: When you flip to this side, flip SP//dr Suit to its ACTIVE side. Attach this card to SP//dr Suit, moving all counters on this card or cards attached to this card to SP//dr Suit.",
        image: "https://hallofheroeslcg.com/wp-content/uploads/2022/09/s2.jpg",
      },
      evidence:
        "Hall of Heroes SP//dr release-page gallery, https://hallofheroeslcg.com/peni-parker-sp-dr/ — " +
        's0a.jpg (Peni Parker, alter-ego, collector mark "2A") and s2.jpg (SP//dr upgrade side, collector mark "SP//DR (2/17)", "2B"); ' +
        'both viewed directly 2026-09-19, not stored (CLAUDE.md "Content & IP boundaries"). ' +
        'Hit points (14) and hand size (4) cross-checked against the same dial SP//dr Suit prints (insert, "Separated Identity Card": ' +
        '"Both identity cards share a single hit point dial").',
    },
  },
};
