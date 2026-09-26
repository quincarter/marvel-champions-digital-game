/**
 * Ironheart (Riri Williams) Hero Pack (Cycle 5) curation.
 *
 * **Not a three-sided identity (Ant-Man/Wasp's shape, docs/phase7-wave2.md §1.1) — three separate, complete
 * hero/alter-ego identity pairs**, one physical two-sided card each: 29001a/29001b (Version 1, hand size 4),
 * 29002a/29002b (Version 2, hand size 5), 29003a/29003b (Version 3, hand size 6). Confirmed from each hero
 * face's own printed text ("Version 1."/"Version 2."/"Version 3." trait-line, `real_traits`) and each Level Up!
 * ability ("swap her with VERSION 2/3 Ironheart") and 29001b's own "Begin the game with this card. Set your
 * other identities aside." This already normalizes correctly as three separate `HeroIdentityCard`s with no
 * normalizer change needed — `normalizeHeroes` doesn't require a set to contain exactly one identity pair.
 *
 * **No `imageOverrides` entry needed for 29002a/29002b/29003a/29003b**, though MarvelCDB has no `imagesrc` at
 * all for any of the four (`imagesrc: null` on all four raw records — Version 1's pair, 29001a/29001b, does have
 * art). Hall of Heroes' own Ironheart release-page gallery (https://hallofheroeslcg.com/ironheart-riri-williams/)
 * hosts a second, independent scan for all six identity faces (`i0a.jpg`–`i0f.jpg`); each was fetched and viewed
 * directly and matched to its card by title, printed text, hand size/hit points and the collector mark in the
 * corner:
 * - `i0a.jpg` = "1B" (Riri Williams, Version 1) — already covered by MarvelCDB's own 29001b art; not used.
 * - `i0b.jpg` = "2B" (Riri Williams, Version 2) → 29002b.
 * - `i0c.jpg` = "3B" (Riri Williams, Version 3) → 29003b.
 * - `i0d.jpg` = "1A" (Ironheart, Version 1) — already covered by MarvelCDB's own 29001a art; not used.
 * - `i0e.jpg` = "2A" (Ironheart, Version 2) → 29002a.
 * - `i0f.jpg` = "3A" (Ironheart, Version 3) → 29003a.
 * `scripts/fetch_card_art.py` fetched and trimmed each to `assets/card-art/bundles/cards/<code>.png`, and
 * `withLocalArt` (`scripts/marvelcdb/normalize/art.ts`) picks up any `<code>.png` under that folder for a record
 * with no `imagesrc` of its own — the same fallback `jubilee.ts`/`psylocke.ts` describe — so no curation entry
 * is needed once the scan exists locally (an `imageOverrides` entry for a code `withLocalArt` already covers
 * fails `checkCoverage`'s "matched no face that needed it" check).
 *
 * Otherwise normalizes cleanly — the schema-neutral parser fixes (docs/phase7-wave2-data.md) already cover every
 * other shape this pack uses.
 *
 * **Starter deck and scenario data not curated this pass** — this pass emits the pack's cards only (data-only
 * pool, PLAN.md Phase 7 "All other packs become card data"); precon curation is a follow-up. A precon for
 * Ironheart will need to say which of the three Version identities it uses (almost certainly Version 1, the
 * "Begin the game with this card" one).
 */
import type { PackCuration } from "./types.ts";

export const IRONHEART_CURATION: PackCuration = {
  packCode: "ironheart",
  cycle: { id: "cycle5", name: "Cycle 5", order: 5 },
  pack: {
    name: "Ironheart",
    releaseDate: "2022-05-20",
    releaseDateSource:
      'Hall of Heroes Ironheart/Riri Williams page (https://hallofheroeslcg.com/ironheart-riri-williams/): "Release date: May 20, 2022"',
  },
  outDir: "src/data/ironheart",
  exportPrefix: "IRONHEART",

  corrections: [],
  errata: [],

  scriptingNotes: {
    "29001a.level-up":
      "Level Up! Action: remove 6 progress counters from Ironheart -> ready her and swap her with Version 2 Ironheart (29002a). A same-identity hero-form swap, not a flip.",
    "29002a.level-up":
      "Level Up! Action: remove 6 progress counters -> ready her, give her a tough status card, and swap her with Version 3 Ironheart (29003a).",
  },
  cardNotes: {
    "29001a":
      "Ironheart is three separate two-sided identity cards (Version 1/2/3, not a three-sided foldable card) — see this file's header comment.",
  },

  scenarios: [],
  starterDecks: [],
};
