// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/cap (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/cap.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/cap.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack cap [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const CAP_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("cap-leadership"),
    name: "Captain America (Leadership) — Hero Pack starter deck",
    packCode: setCode("cap"),
    identityCardId: cardId("03001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("03002"), quantity: 1 },
      { cardId: cardId("03003"), quantity: 2 },
      { cardId: cardId("03004"), quantity: 3 },
      { cardId: cardId("03005"), quantity: 2 },
      { cardId: cardId("03006"), quantity: 2 },
      { cardId: cardId("03007"), quantity: 1 },
      { cardId: cardId("03008"), quantity: 1 },
      { cardId: cardId("03009"), quantity: 1 },
      { cardId: cardId("03010"), quantity: 2 },
      { cardId: cardId("03011"), quantity: 1 },
      { cardId: cardId("03012"), quantity: 1 },
      { cardId: cardId("03013"), quantity: 1 },
      { cardId: cardId("03014"), quantity: 1 },
      { cardId: cardId("03015"), quantity: 3 },
      { cardId: cardId("03016"), quantity: 2 },
      { cardId: cardId("03017"), quantity: 3 },
      { cardId: cardId("03018"), quantity: 2 },
      { cardId: cardId("03019"), quantity: 3 },
      { cardId: cardId("03020"), quantity: 1 },
      { cardId: cardId("03021"), quantity: 1 },
      { cardId: cardId("03022"), quantity: 1 },
      { cardId: cardId("03023"), quantity: 1 },
      { cardId: cardId("03024"), quantity: 1 },
      { cardId: cardId("03025"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Captain America Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/06/capamericadeck-1.jpg, linked from https://hallofheroeslcg.com/captain-america/)",
      ],
    },
  },
];
