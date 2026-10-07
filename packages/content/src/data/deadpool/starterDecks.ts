// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/deadpool (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/deadpool.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/deadpool.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack deadpool [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const DEADPOOL_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("deadpool-pool"),
    name: "Deadpool ('Pool) — Deadpool Hero Pack starter deck",
    packCode: setCode("deadpool"),
    identityCardId: cardId("44001a"),
    aspects: ["pool"],
    cards: [
      { cardId: cardId("44002"), quantity: 1 },
      { cardId: cardId("44003"), quantity: 1 },
      { cardId: cardId("44004"), quantity: 2 },
      { cardId: cardId("44005"), quantity: 1 },
      { cardId: cardId("44006"), quantity: 2 },
      { cardId: cardId("44007"), quantity: 1 },
      { cardId: cardId("44008"), quantity: 1 },
      { cardId: cardId("44009"), quantity: 1 },
      { cardId: cardId("44010"), quantity: 2 },
      { cardId: cardId("44011"), quantity: 1 },
      { cardId: cardId("44012"), quantity: 2 },
      { cardId: cardId("44013"), quantity: 1 },
      { cardId: cardId("44014"), quantity: 1 },
      { cardId: cardId("44015"), quantity: 1 },
      { cardId: cardId("44016"), quantity: 1 },
      { cardId: cardId("44017"), quantity: 3 },
      { cardId: cardId("44018"), quantity: 1 },
      { cardId: cardId("44019"), quantity: 1 },
      { cardId: cardId("44020"), quantity: 1 },
      { cardId: cardId("44021"), quantity: 3 },
      { cardId: cardId("44022"), quantity: 1 },
      { cardId: cardId("44023"), quantity: 1 },
      { cardId: cardId("44024"), quantity: 1 },
      { cardId: cardId("44025"), quantity: 1 },
      { cardId: cardId("44026"), quantity: 1 },
      { cardId: cardId("44027"), quantity: 1 },
      { cardId: cardId("44028"), quantity: 1 },
      { cardId: cardId("44029"), quantity: 3 },
      { cardId: cardId("44030"), quantity: 1 },
      { cardId: cardId("44031"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Deadpool Hero Pack printed decklist card, \"Deadpool Deck\" (photo supplied by the owner, 2026-10-04)",
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Deadpool, 24 'Pool, 1 basic (Frenemies). Read from the pack's printed decklist card (the owner's photo, 2026-10-04): entries 2-31 with the quantities here. The card lists the Dreadpool set (44037-44042) apart; the 'Pool cards 44043-44058 are not on the decklist card.",
    },
  },
];
