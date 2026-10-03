// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/rogue (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/rogue.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/rogue.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack rogue [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const ROGUE_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("rogue-protection"),
    name: "Rogue (Protection) — Rogue Hero Pack starter deck",
    packCode: setCode("rogue"),
    identityCardId: cardId("38001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("38002"), quantity: 1 },
      { cardId: cardId("38003"), quantity: 1 },
      { cardId: cardId("38004"), quantity: 1 },
      { cardId: cardId("38005"), quantity: 3 },
      { cardId: cardId("38006"), quantity: 3 },
      { cardId: cardId("38007"), quantity: 2 },
      { cardId: cardId("38008"), quantity: 2 },
      { cardId: cardId("38009"), quantity: 3 },
      { cardId: cardId("38010"), quantity: 1 },
      { cardId: cardId("38011"), quantity: 1 },
      { cardId: cardId("38012"), quantity: 1 },
      { cardId: cardId("38013"), quantity: 3 },
      { cardId: cardId("38014"), quantity: 3 },
      { cardId: cardId("38015"), quantity: 3 },
      { cardId: cardId("38016"), quantity: 3 },
      { cardId: cardId("38017"), quantity: 2 },
      { cardId: cardId("38018"), quantity: 1 },
      { cardId: cardId("38019"), quantity: 3 },
      { cardId: cardId("38020"), quantity: 1 },
      { cardId: cardId("38021"), quantity: 1 },
      { cardId: cardId("38022"), quantity: 1 },
      { cardId: cardId("38023"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Rogue Hero Pack printed decklist card, \"Rogue Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2023/01/zzz-1.jpg, the \"Starter Deck\" link on the Hall of Heroes page, https://hallofheroeslcg.com/rogue-anna-marie/), transcribed 2026-10-01 from the card image",
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/rogue.json quantity/deck_limit (full printed quantity for each). The list totals 41 player cards (legal, 40-50).",
    },
  },
];
