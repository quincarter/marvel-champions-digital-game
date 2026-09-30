// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ironheart (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ironheart.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ironheart.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ironheart [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const IRONHEART_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("ironheart-leadership"),
    name: "Ironheart (Leadership) — Ironheart Hero Pack starter deck",
    packCode: setCode("ironheart"),
    identityCardId: cardId("29001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("29004"), quantity: 1 },
      { cardId: cardId("29005"), quantity: 2 },
      { cardId: cardId("29006"), quantity: 3 },
      { cardId: cardId("29007"), quantity: 2 },
      { cardId: cardId("29008"), quantity: 1 },
      { cardId: cardId("29009"), quantity: 2 },
      { cardId: cardId("29010"), quantity: 1 },
      { cardId: cardId("29011"), quantity: 1 },
      { cardId: cardId("29012"), quantity: 1 },
      { cardId: cardId("29013"), quantity: 1 },
      { cardId: cardId("29014"), quantity: 1 },
      { cardId: cardId("29015"), quantity: 1 },
      { cardId: cardId("29016"), quantity: 1 },
      { cardId: cardId("29017"), quantity: 3 },
      { cardId: cardId("29018"), quantity: 3 },
      { cardId: cardId("29019"), quantity: 3 },
      { cardId: cardId("29020"), quantity: 3 },
      { cardId: cardId("29021"), quantity: 2 },
      { cardId: cardId("29022"), quantity: 1 },
      { cardId: cardId("29023"), quantity: 1 },
      { cardId: cardId("29024"), quantity: 1 },
      { cardId: cardId("29025"), quantity: 1 },
      { cardId: cardId("29026"), quantity: 1 },
      { cardId: cardId("29027"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Ironheart Hero Pack printed decklist card, \"Ironheart Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2022/04/card.jpg, linked from the Hall of Heroes Ironheart page, https://hallofheroeslcg.com/ironheart-riri-williams/), transcribed 2026-09-26",
      ],
      note: "No second (MarvelCDB community decklist or rulebook) source found for this pack's precon as of this pass — single-sourced from the pack's own printed decklist card. Uses Version 1 Ironheart (29001a); the engine refuses progressingIdentity until §3.23 (docs/phase7-wave5.md §1.4).",
    },
  },
];
