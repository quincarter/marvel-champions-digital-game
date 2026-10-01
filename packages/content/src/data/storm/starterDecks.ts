// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/storm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/storm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/storm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack storm [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const STORM_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("storm-leadership"),
    name: "Storm (Leadership) — Storm Hero Pack starter deck",
    packCode: setCode("storm"),
    identityCardId: cardId("36001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("36002"), quantity: 1 },
      { cardId: cardId("36003"), quantity: 1 },
      { cardId: cardId("36004"), quantity: 1 },
      { cardId: cardId("36005"), quantity: 1 },
      { cardId: cardId("36006"), quantity: 1 },
      { cardId: cardId("36007"), quantity: 1 },
      { cardId: cardId("36008"), quantity: 1 },
      { cardId: cardId("36009"), quantity: 3 },
      { cardId: cardId("36010"), quantity: 3 },
      { cardId: cardId("36011"), quantity: 2 },
      { cardId: cardId("36012"), quantity: 2 },
      { cardId: cardId("36013"), quantity: 2 },
      { cardId: cardId("36014"), quantity: 1 },
      { cardId: cardId("36015"), quantity: 1 },
      { cardId: cardId("36016"), quantity: 1 },
      { cardId: cardId("36017"), quantity: 1 },
      { cardId: cardId("36018"), quantity: 3 },
      { cardId: cardId("36019"), quantity: 3 },
      { cardId: cardId("36020"), quantity: 3 },
      { cardId: cardId("36021"), quantity: 2 },
      { cardId: cardId("36022"), quantity: 1 },
      { cardId: cardId("36023"), quantity: 1 },
      { cardId: cardId("36024"), quantity: 1 },
      { cardId: cardId("36025"), quantity: 1 },
      { cardId: cardId("36026"), quantity: 3 },
      { cardId: cardId("36027"), quantity: 1 },
      { cardId: cardId("36028"), quantity: 1 },
      { cardId: cardId("36029"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Storm Hero Pack printed decklist card, \"Storm Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2022/11/zzz.jpg, the \"Starter Deck\" link on the Hall of Heroes page, https://hallofheroeslcg.com/ororo-munroe-storm/), transcribed 2026-10-01 from the card image",
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/storm.json quantity/deck_limit (full printed quantity for each). The list totals 44 player cards (legal, 40-50). The four Weather Deck cards (36002-36005) are Storm's own hero-set cards (auxiliary set storm_weather_deck).",
    },
  },
];
