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
 * **`progressingIdentity` (docs/phase7-wave5.md §1.4).** The Ironheart insert, "New Rules: Progressing Identity
 * Cards" (read as an image 2026-09-26, not stored): all three versions share one hit point dial, and 29001a
 * (Version 1) is the one whose alter-ego (29001b) prints "Begin the game with this card." Set on all three hero
 * records, weakest first, so `HeroIdentityCard.progressingIdentity.versions` is `["29001a", "29002a", "29003a"]`
 * on every one of them (schema requires the card list itself, not just the first version's).
 *
 * **Precon (docs/phase7-wave5.md §1.9, §5; docs/phase7-wave5-sources.md §5):** transcribed 2026-09-26 from the
 * pack's own printed decklist card, "Ironheart Deck", https://hallofheroeslcg.com/wp-content/uploads/2022/04/card.jpg
 * (fetched via `scripts/fetch_card_art.py grab`, viewed directly, not stored — CLAUDE.md "Content & IP
 * boundaries"). Uses Version 1 (`29001a`, the "Begin the game with this card" identity, §1.4) as `identityCode` —
 * the only version whose alter-ego prints "Begin the game with this card. Set your other identities aside.".
 * Every card code and quantity cross-checked against `raw/marvelcdb/ironheart.json`'s own `quantity`/`deck_limit`
 * fields (all 10 hero-kit cards at full printed quantity); no second source found for this pack's precon as of
 * this pass.
 */
import type { PackCuration } from "./types.ts";

export const IRONHEART_CURATION: PackCuration = {
  packCode: "ironheart",
  cycle: { id: "cycle5", name: "Sinister Motives", order: 5 },
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

  progressingIdentity: {
    "29001a": ["29001a", "29002a", "29003a"],
    "29002a": ["29001a", "29002a", "29003a"],
    "29003a": ["29001a", "29002a", "29003a"],
  },

  scenarios: [],
  starterDecks: [
    {
      id: "ironheart-leadership",
      name: "Ironheart (Leadership) — Ironheart Hero Pack starter deck",
      identityCode: "29001a",
      aspect: "leadership",
      cards: {
        "29004": 1, // Brawn
        "29005": 2, // Fly Over
        "29006": 3, // Photon Beam
        "29007": 2, // New and Improved
        "29008": 1, // Sector Scan
        "29009": 2, // Stroke of Genius
        "29010": 1, // Ronnie Williams
        "29011": 1, // Tony Stark A.I.
        "29012": 1, // Photon Blasters
        "29013": 1, // Propulsion Jets
        "29014": 1, // Cloud 9
        "29015": 1, // Falcon
        "29016": 1, // Patriot
        "29017": 3, // Go All Out
        "29018": 3, // Push Ahead
        "29019": 3, // Morale Boost
        "29020": 3, // R&D Facility
        "29021": 2, // The Power of Leadership
        "29022": 1, // Agent 13
        "29023": 1, // Snowguard
        "29024": 1, // Vivian
        "29025": 1, // "Go for Champions!"
        "29026": 1, // Helicarrier
        "29027": 3, // Ingenuity
      },
      obligationCode: "29028",
      nemesisCodes: ["29029", "29030", "29031", "29032"],
      verified: true,
      sources: [
        'Ironheart Hero Pack printed decklist card, "Ironheart Deck" (https://hallofheroeslcg.com/wp-content/uploads/2022/04/card.jpg, linked from the Hall of Heroes Ironheart page, https://hallofheroeslcg.com/ironheart-riri-williams/), transcribed 2026-09-26',
      ],
      note: "No second (MarvelCDB community decklist or rulebook) source found for this pack's precon as of this pass — single-sourced from the pack's own printed decklist card. Uses Version 1 Ironheart (29001a); the engine refuses progressingIdentity until §3.23 (docs/phase7-wave5.md §1.4).",
    },
  ],
};
