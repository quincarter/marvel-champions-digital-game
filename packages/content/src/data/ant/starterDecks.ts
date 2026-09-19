// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ant (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ant.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ant.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ant [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const ANT_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("ant-leadership"),
    name: "Ant-Man (Leadership) — Hero Pack starter deck",
    packCode: setCode("ant"),
    identityCardId: cardId("12001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("12002"), quantity: 1 },
      { cardId: cardId("12003"), quantity: 2 },
      { cardId: cardId("12004"), quantity: 1 },
      { cardId: cardId("12005"), quantity: 2 },
      { cardId: cardId("12006"), quantity: 2 },
      { cardId: cardId("12007"), quantity: 3 },
      { cardId: cardId("12008"), quantity: 1 },
      { cardId: cardId("12009"), quantity: 2 },
      { cardId: cardId("12010"), quantity: 1 },
      { cardId: cardId("12011"), quantity: 1 },
      { cardId: cardId("12012"), quantity: 1 },
      { cardId: cardId("12013"), quantity: 1 },
      { cardId: cardId("12014"), quantity: 1 },
      { cardId: cardId("12015"), quantity: 3 },
      { cardId: cardId("12016"), quantity: 3 },
      { cardId: cardId("12017"), quantity: 3 },
      { cardId: cardId("12018"), quantity: 3 },
      { cardId: cardId("12019"), quantity: 2 },
      { cardId: cardId("12020"), quantity: 1 },
      { cardId: cardId("12021"), quantity: 1 },
      { cardId: cardId("12022"), quantity: 1 },
      { cardId: cardId("12023"), quantity: 1 },
      { cardId: cardId("12024"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Ant-Man Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/11/antmanstarterdeck.jpg, linked from https://hallofheroeslcg.com/ant-man/)",
      ],
    },
  },
];
