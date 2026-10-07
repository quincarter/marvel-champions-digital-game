/**
 * Jubilee (Jubilation Lee) Hero Pack (Cycle 8) curation.
 *
 * Normalizes cleanly with zero hand corrections (`survey.ts --pack jubilee`; confirmed before this file existed
 * — same shape as `angel`/`falcon`/`magneto` and every other zero-correction pack in this pool). Every record
 * carries its own `imagesrc` except Jubilee's own identity pair (47001a/b), which fall back to the repo's local
 * card scans via `withLocalArt` (`assets/card-art/bundles/cards/47001a.png`, `47001b.png`) — no artwork gap.
 *
 * **Scenario data not curated this pass** — data-only pool (PLAN.md Phase 7). The Justice starter deck comes from the
 * pack's printed decklist card. One title correction: 47009 (see `corrections`).
 */
import type { PackCuration } from "./types.ts";

export const JUBILEE_CURATION: PackCuration = {
  packCode: "jubilee",
  cycle: { id: "cycle8", name: "Age of Apocalypse", order: 8 },
  pack: {
    name: "Jubilee",
    releaseDate: "2024-07-19",
    releaseDateSource:
      'Hall of Heroes Jubilee/Jubilation Lee page (https://hallofheroeslcg.com/jubilee-jubilation-lee/): "Release date: July 19, 2024"; cycle grouping confirmed against Hall of Heroes\' own card database navigation (https://hallofheroeslcg.com/browse/), which lists Jubilee alongside Iceman, Nightcrawler and Magneto under Cycle 8.',
  },
  outDir: "src/data/jubilee",
  exportPrefix: "JUBILEE",

  corrections: [
    {
      code: "47009",
      name: "Grand Finale",
      reason: 'MarvelCDB spells the title "Grande Finale"; the card prints "Grand Finale".',
      evidence:
        "The card's own scan (assets/card-art/bundles/cards/47009.jpg) prints GRAND FINALE; the pack's printed decklist card (the owner's photo, 2026-10-07, docs/phase7-wave8-handoff.md) reads \"9 Grand Finale\".",
    },
  ],
  errata: [],

  scriptingNotes: {},
  cardNotes: {},

  scenarios: [],
  starterDecks: [
    {
      id: "jubilee-justice",
      name: "Jubilee (Justice) — Jubilee Hero Pack starter deck",
      identityCode: "47001a",
      aspect: "justice",
      cards: {
        "47002": 1, // Wolverine
        "47003": 1, // Shopping Spree
        "47004": 1, // Jubilee's Coat
        "47005": 1, // Jubilee's Sunglasses
        "47006": 1, // Blinding Flash
        "47007a": 1, // Firecracker (version a of three)
        "47007b": 1, // Firecracker (version b)
        "47007c": 1, // Firecracker (version c)
        "47008a": 1, // Flash of Light (version a of three)
        "47008b": 1, // Flash of Light (version b)
        "47008c": 1, // Flash of Light (version c)
        "47009": 1, // Grand Finale
        "47010a": 1, // Plasmoid Energy (version a of three)
        "47010b": 1, // Plasmoid Energy (version b)
        "47010c": 1, // Plasmoid Energy (version c)
        "47011": 1, // Chamber
        "47012": 1, // Husk
        "47013": 3, // Disguise
        "47014": 3, // Waylay
        "47015": 3, // Three Steps Ahead
        "47016": 1, // Generation X
        "47017": 2, // The Power of Justice
        "47018": 1, // Synch
        "47019": 3, // Cell Phone
        "47020": 3, // X-Gene
        "47021": 3, // Multitalented
        "47022": 1, // Unlikely Duo
      },
      obligationCode: "47023",
      nemesisCodes: ["47024", "47025", "47026", "47027"],
      verified: true,
      sources: [
        'Jubilee Hero Pack printed decklist card, "Jubilee Deck" (the owner\'s photo of the card, 2026-10-07), transcribed in docs/phase7-wave8-handoff.md',
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Jubilee, 14 Justice, 11 basic. Identity is 47001a. Firecracker (47007), Flash of Light (47008) and Plasmoid Energy (47010) are printed x3 and MarvelCDB stores each as three one-copy records (a/b/c, three versions of the card), so the deck holds one copy of each of the nine records. Unlikely Duo (47022) is one copy as printed (Max 1 per deck; MarvelCDB's raw quantity of 2 is the pack count). The printed card numbers equal the codes' last digits; every other title and quantity matches raw/marvelcdb/jubilee.json.",
    },
  ],
};
