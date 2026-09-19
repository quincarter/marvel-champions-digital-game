// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/scw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/scw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/scw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack scw [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const SCW_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("scw-justice"),
    name: "Scarlet Witch (Justice) — Hero Pack starter deck",
    packCode: setCode("scw"),
    identityCardId: cardId("15001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("15002"), quantity: 1 },
      { cardId: cardId("15003"), quantity: 1 },
      { cardId: cardId("15004"), quantity: 4 },
      { cardId: cardId("15005"), quantity: 3 },
      { cardId: cardId("15006"), quantity: 1 },
      { cardId: cardId("15007"), quantity: 1 },
      { cardId: cardId("15008"), quantity: 3 },
      { cardId: cardId("15009"), quantity: 1 },
      { cardId: cardId("15010"), quantity: 1 },
      { cardId: cardId("15011"), quantity: 1 },
      { cardId: cardId("15012"), quantity: 3 },
      { cardId: cardId("15013"), quantity: 3 },
      { cardId: cardId("15014"), quantity: 3 },
      { cardId: cardId("15015"), quantity: 3 },
      { cardId: cardId("15016"), quantity: 2 },
      { cardId: cardId("15017"), quantity: 2 },
      { cardId: cardId("15018"), quantity: 1 },
      { cardId: cardId("15019"), quantity: 3 },
      { cardId: cardId("15020"), quantity: 1 },
      { cardId: cardId("15021"), quantity: 1 },
      { cardId: cardId("15022"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Scarlet Witch Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2021/03/scw1.jpg, linked from https://hallofheroeslcg.com/scarlet-witch/)",
      ],
    },
  },
];
