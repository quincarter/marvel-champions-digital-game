// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/valk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/valk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/valk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack valk [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const VALK_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("valkyrie-aggression"),
    name: "Valkyrie (Aggression) — starter deck",
    packCode: setCode("valk"),
    identityCardId: cardId("25001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("25002"), quantity: 1 },
      { cardId: cardId("25003"), quantity: 1 },
      { cardId: cardId("25004"), quantity: 1 },
      { cardId: cardId("25005"), quantity: 1 },
      { cardId: cardId("25006"), quantity: 1 },
      { cardId: cardId("25007"), quantity: 1 },
      { cardId: cardId("25008"), quantity: 2 },
      { cardId: cardId("25009"), quantity: 1 },
      { cardId: cardId("25010"), quantity: 2 },
      { cardId: cardId("25011"), quantity: 2 },
      { cardId: cardId("25012"), quantity: 3 },
      { cardId: cardId("25013"), quantity: 1 },
      { cardId: cardId("25014"), quantity: 1 },
      { cardId: cardId("25015"), quantity: 1 },
      { cardId: cardId("25016"), quantity: 1 },
      { cardId: cardId("25017"), quantity: 2 },
      { cardId: cardId("25018"), quantity: 3 },
      { cardId: cardId("25019"), quantity: 3 },
      { cardId: cardId("25020"), quantity: 3 },
      { cardId: cardId("25021"), quantity: 1 },
      { cardId: cardId("25022"), quantity: 1 },
      { cardId: cardId("25023"), quantity: 1 },
      { cardId: cardId("25024"), quantity: 3 },
      { cardId: cardId("25025"), quantity: 1 },
      { cardId: cardId("25026"), quantity: 1 },
      { cardId: cardId("25027"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes Valkyrie release page (https://hallofheroeslcg.com/brunnhilde-valkyrie/), \"Starter Deck\" link: https://hallofheroeslcg.com/wp-content/uploads/2021/11/1.jpg — image transcribed directly (card-data-pipeline, wave 4).",
        "MarvelCDB public API card records for the valk pack (packages/content/raw/marvelcdb/valk.json) — every card's quantityInSet/deckLimit matches the transcribed deck exactly.",
      ],
      note: "40 cards = 16 Valkyrie + 17 Aggression + 7 Basic, matching the printed deck-list card's own counts (see the module doc comment above on that card's own numbering slip). Nemesis set (Enchantress minion, Powerful Enchantments, Beguiled, Seduced x2) matches the identity's own nemesisEncounterSetId.",
    },
  },
];
