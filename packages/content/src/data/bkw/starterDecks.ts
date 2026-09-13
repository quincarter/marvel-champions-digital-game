// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/bkw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/bkw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/bkw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack bkw [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const BKW_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("bkw-justice"),
    name: "Black Widow (Justice) — Hero Pack starter deck",
    packCode: setCode("bkw"),
    identityCardId: cardId("08001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("08002"), quantity: 1 },
      { cardId: cardId("08003"), quantity: 2 },
      { cardId: cardId("08004"), quantity: 2 },
      { cardId: cardId("08005"), quantity: 1 },
      { cardId: cardId("08006"), quantity: 2 },
      { cardId: cardId("08007"), quantity: 2 },
      { cardId: cardId("08008"), quantity: 2 },
      { cardId: cardId("08009"), quantity: 1 },
      { cardId: cardId("08010"), quantity: 2 },
      { cardId: cardId("08011"), quantity: 1 },
      { cardId: cardId("08012"), quantity: 1 },
      { cardId: cardId("08013"), quantity: 3 },
      { cardId: cardId("08014"), quantity: 2 },
      { cardId: cardId("08015"), quantity: 2 },
      { cardId: cardId("08016"), quantity: 2 },
      { cardId: cardId("08017"), quantity: 3 },
      { cardId: cardId("08018"), quantity: 3 },
      { cardId: cardId("08019"), quantity: 1 },
      { cardId: cardId("08020"), quantity: 1 },
      { cardId: cardId("08021"), quantity: 1 },
      { cardId: cardId("08022"), quantity: 1 },
      { cardId: cardId("08023"), quantity: 1 },
      { cardId: cardId("08024"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Black Widow Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/04/widowstarterdeck.jpg, linked from https://hallofheroeslcg.com/natasha-romanoff-black-widow/)",
      ],
    },
  },
];
