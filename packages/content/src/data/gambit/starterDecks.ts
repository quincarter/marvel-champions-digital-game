// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gambit (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gambit.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gambit.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gambit [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const GAMBIT_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("gambit-justice"),
    name: "Gambit (Justice) — Gambit Hero Pack starter deck",
    packCode: setCode("gambit"),
    identityCardId: cardId("37001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("37002"), quantity: 1 },
      { cardId: cardId("37003"), quantity: 1 },
      { cardId: cardId("37004"), quantity: 1 },
      { cardId: cardId("37005"), quantity: 1 },
      { cardId: cardId("37006"), quantity: 3 },
      { cardId: cardId("37007"), quantity: 2 },
      { cardId: cardId("37008"), quantity: 2 },
      { cardId: cardId("37009"), quantity: 2 },
      { cardId: cardId("37010"), quantity: 2 },
      { cardId: cardId("37011"), quantity: 1 },
      { cardId: cardId("37012"), quantity: 1 },
      { cardId: cardId("37013"), quantity: 3 },
      { cardId: cardId("37014"), quantity: 3 },
      { cardId: cardId("37015"), quantity: 3 },
      { cardId: cardId("37016"), quantity: 2 },
      { cardId: cardId("37017"), quantity: 1 },
      { cardId: cardId("37018"), quantity: 1 },
      { cardId: cardId("37019"), quantity: 1 },
      { cardId: cardId("37020"), quantity: 3 },
      { cardId: cardId("37021"), quantity: 3 },
      { cardId: cardId("37022"), quantity: 1 },
      { cardId: cardId("37023"), quantity: 1 },
      { cardId: cardId("37024"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Gambit Hero Pack printed decklist card, \"Gambit Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2023/01/zzz.jpg, the \"Starter Deck\" link on the Hall of Heroes page, https://hallofheroeslcg.com/gambit-remy-lebeau/), transcribed 2026-10-01 from the card image",
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/gambit.json quantity/deck_limit (full printed quantity for each). The list totals 40 player cards (legal, 40-50).",
    },
  },
];
