// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/nova (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/nova.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/nova.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack nova [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const NOVA_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("nova-aggression"),
    name: "Nova (Aggression) — Nova Hero Pack starter deck",
    packCode: setCode("nova"),
    identityCardId: cardId("28001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("28002"), quantity: 1 },
      { cardId: cardId("28003"), quantity: 2 },
      { cardId: cardId("28004"), quantity: 3 },
      { cardId: cardId("28005"), quantity: 3 },
      { cardId: cardId("28006"), quantity: 2 },
      { cardId: cardId("28007"), quantity: 2 },
      { cardId: cardId("28008"), quantity: 1 },
      { cardId: cardId("28009"), quantity: 1 },
      { cardId: cardId("28010"), quantity: 1 },
      { cardId: cardId("28011"), quantity: 2 },
      { cardId: cardId("28012"), quantity: 3 },
      { cardId: cardId("28013"), quantity: 3 },
      { cardId: cardId("28014"), quantity: 3 },
      { cardId: cardId("28015"), quantity: 2 },
      { cardId: cardId("28016"), quantity: 3 },
      { cardId: cardId("28017"), quantity: 3 },
      { cardId: cardId("28018"), quantity: 1 },
      { cardId: cardId("28019"), quantity: 3 },
      { cardId: cardId("28020"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Nova Hero Pack printed decklist card, \"Nova Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2022/05/deck1.jpeg, linked from the Hall of Heroes Nova page, https://hallofheroeslcg.com/sam-alexander-nova/), transcribed 2026-09-26",
      ],
      note: "No second (MarvelCDB community decklist or rulebook) source found for this pack's precon as of this pass — single-sourced from the pack's own printed decklist card.",
    },
  },
];
