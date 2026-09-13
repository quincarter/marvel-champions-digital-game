// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/hlk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/hlk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/hlk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack hlk [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const HLK_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("hlk-aggression"),
    name: "Hulk (Aggression) — Hero Pack starter deck",
    packCode: setCode("hlk"),
    identityCardId: cardId("10001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("10002"), quantity: 2 },
      { cardId: cardId("10003"), quantity: 2 },
      { cardId: cardId("10004"), quantity: 2 },
      { cardId: cardId("10005"), quantity: 2 },
      { cardId: cardId("10006"), quantity: 2 },
      { cardId: cardId("10007"), quantity: 2 },
      { cardId: cardId("10008"), quantity: 1 },
      { cardId: cardId("10009"), quantity: 1 },
      { cardId: cardId("10010"), quantity: 1 },
      { cardId: cardId("10011"), quantity: 1 },
      { cardId: cardId("10012"), quantity: 1 },
      { cardId: cardId("10013"), quantity: 1 },
      { cardId: cardId("10014"), quantity: 3 },
      { cardId: cardId("10015"), quantity: 3 },
      { cardId: cardId("10016"), quantity: 3 },
      { cardId: cardId("10017"), quantity: 2 },
      { cardId: cardId("10018"), quantity: 3 },
      { cardId: cardId("10019"), quantity: 3 },
      { cardId: cardId("10020"), quantity: 1 },
      { cardId: cardId("10021"), quantity: 1 },
      { cardId: cardId("10022"), quantity: 1 },
      { cardId: cardId("10023"), quantity: 1 },
      { cardId: cardId("10024"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hulk Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/06/hulkstarterdeck-1.jpg, linked from https://hallofheroeslcg.com/bruce-banner-hulk/)",
      ],
    },
  },
];
