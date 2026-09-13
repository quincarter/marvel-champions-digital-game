// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/thor (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/thor.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/thor.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack thor [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const THOR_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("thor-aggression"),
    name: "Thor (Aggression) — Hero Pack starter deck",
    packCode: setCode("thor"),
    identityCardId: cardId("06001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("06002"), quantity: 1 },
      { cardId: cardId("06003"), quantity: 3 },
      { cardId: cardId("06004"), quantity: 1 },
      { cardId: cardId("06005"), quantity: 3 },
      { cardId: cardId("06006"), quantity: 2 },
      { cardId: cardId("06007"), quantity: 1 },
      { cardId: cardId("06008"), quantity: 2 },
      { cardId: cardId("06009"), quantity: 1 },
      { cardId: cardId("06010"), quantity: 1 },
      { cardId: cardId("06011"), quantity: 1 },
      { cardId: cardId("06012"), quantity: 1 },
      { cardId: cardId("06013"), quantity: 2 },
      { cardId: cardId("06014"), quantity: 3 },
      { cardId: cardId("06015"), quantity: 3 },
      { cardId: cardId("06016"), quantity: 2 },
      { cardId: cardId("06017"), quantity: 1 },
      { cardId: cardId("06018"), quantity: 3 },
      { cardId: cardId("06019"), quantity: 1 },
      { cardId: cardId("06020"), quantity: 1 },
      { cardId: cardId("06021"), quantity: 3 },
      { cardId: cardId("06022"), quantity: 1 },
      { cardId: cardId("06023"), quantity: 1 },
      { cardId: cardId("06024"), quantity: 1 },
      { cardId: cardId("06025"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Thor Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/03/thorstarterdeck1.jpg, linked from https://hallofheroeslcg.com/thor/)",
      ],
    },
  },
];
