// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/phoenix (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/phoenix.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/phoenix.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack phoenix [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const PHOENIX_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("phoenix-justice"),
    name: "Phoenix (Justice) — Phoenix Hero Pack starter deck",
    packCode: setCode("phoenix"),
    identityCardId: cardId("34001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("34002a"), quantity: 1 },
      { cardId: cardId("34003"), quantity: 1 },
      { cardId: cardId("34004"), quantity: 1 },
      { cardId: cardId("34005"), quantity: 1 },
      { cardId: cardId("34006"), quantity: 1 },
      { cardId: cardId("34007"), quantity: 1 },
      { cardId: cardId("34008"), quantity: 1 },
      { cardId: cardId("34009"), quantity: 1 },
      { cardId: cardId("34010"), quantity: 2 },
      { cardId: cardId("34011"), quantity: 2 },
      { cardId: cardId("34012"), quantity: 2 },
      { cardId: cardId("34013"), quantity: 2 },
      { cardId: cardId("34014"), quantity: 1 },
      { cardId: cardId("34015"), quantity: 1 },
      { cardId: cardId("34016"), quantity: 3 },
      { cardId: cardId("34017"), quantity: 3 },
      { cardId: cardId("34018"), quantity: 3 },
      { cardId: cardId("34019"), quantity: 3 },
      { cardId: cardId("34020"), quantity: 2 },
      { cardId: cardId("34021"), quantity: 1 },
      { cardId: cardId("34022"), quantity: 1 },
      { cardId: cardId("34023"), quantity: 1 },
      { cardId: cardId("34024"), quantity: 3 },
      { cardId: cardId("34025"), quantity: 1 },
      { cardId: cardId("34026"), quantity: 1 },
      { cardId: cardId("34027"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Phoenix Hero Pack printed decklist card, \"Phoenix Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2022/09/jean.jpg, the \"Starter Deck\" link on the Hall of Heroes Jean Grey/Phoenix page, https://hallofheroeslcg.com/jean-grey-phoenix/), transcribed 2026-10-01 from a photo of the card",
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/phoenix.json quantity/deck_limit. The list totals 41 player cards (legal, 40-50).",
    },
  },
];
