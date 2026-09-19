// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wsp (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wsp.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wsp.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wsp [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const WSP_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("wsp-aggression"),
    name: "Wasp (Aggression) — Hero Pack starter deck",
    packCode: setCode("wsp"),
    identityCardId: cardId("13001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("13002"), quantity: 1 },
      { cardId: cardId("13003"), quantity: 2 },
      { cardId: cardId("13004"), quantity: 3 },
      { cardId: cardId("13005"), quantity: 2 },
      { cardId: cardId("13006"), quantity: 2 },
      { cardId: cardId("13007"), quantity: 2 },
      { cardId: cardId("13008"), quantity: 1 },
      { cardId: cardId("13009"), quantity: 1 },
      { cardId: cardId("13010"), quantity: 1 },
      { cardId: cardId("13011"), quantity: 1 },
      { cardId: cardId("13012"), quantity: 1 },
      { cardId: cardId("13013"), quantity: 3 },
      { cardId: cardId("13014"), quantity: 3 },
      { cardId: cardId("13015"), quantity: 2 },
      { cardId: cardId("13016"), quantity: 3 },
      { cardId: cardId("13017"), quantity: 3 },
      { cardId: cardId("13018"), quantity: 1 },
      { cardId: cardId("13019"), quantity: 1 },
      { cardId: cardId("13020"), quantity: 1 },
      { cardId: cardId("13021"), quantity: 1 },
      { cardId: cardId("13022"), quantity: 1 },
      { cardId: cardId("13023"), quantity: 1 },
      { cardId: cardId("13024"), quantity: 2 },
      { cardId: cardId("13025"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Wasp Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/12/waspstarterdeck.jpg, linked from https://hallofheroeslcg.com/wasp/)",
      ],
    },
  },
];
