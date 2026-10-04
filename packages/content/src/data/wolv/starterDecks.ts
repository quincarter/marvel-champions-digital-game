// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wolv (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wolv.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wolv.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wolv [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const WOLV_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("wolverine-aggression"),
    name: "Wolverine (Aggression) — Wolverine Hero Pack starter deck",
    packCode: setCode("wolv"),
    identityCardId: cardId("35001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("35002"), quantity: 1 },
      { cardId: cardId("35003"), quantity: 1 },
      { cardId: cardId("35004"), quantity: 1 },
      { cardId: cardId("35005"), quantity: 1 },
      { cardId: cardId("35006"), quantity: 1 },
      { cardId: cardId("35007"), quantity: 1 },
      { cardId: cardId("35008"), quantity: 2 },
      { cardId: cardId("35009"), quantity: 2 },
      { cardId: cardId("35010"), quantity: 2 },
      { cardId: cardId("35011"), quantity: 2 },
      { cardId: cardId("35012"), quantity: 2 },
      { cardId: cardId("35013"), quantity: 1 },
      { cardId: cardId("35014"), quantity: 1 },
      { cardId: cardId("35015"), quantity: 3 },
      { cardId: cardId("35016"), quantity: 3 },
      { cardId: cardId("35017"), quantity: 3 },
      { cardId: cardId("35018"), quantity: 3 },
      { cardId: cardId("35019"), quantity: 3 },
      { cardId: cardId("35020"), quantity: 2 },
      { cardId: cardId("35021"), quantity: 1 },
      { cardId: cardId("35022"), quantity: 1 },
      { cardId: cardId("35023"), quantity: 1 },
      { cardId: cardId("35024"), quantity: 1 },
      { cardId: cardId("35025"), quantity: 1 },
      { cardId: cardId("35026"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Wolverine Hero Pack printed decklist card, \"Wolverine Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2022/11/zzt.jpg, the \"Starter Deck\" link on the Hall of Heroes page, https://hallofheroeslcg.com/logan-wolverine/), transcribed 2026-10-01 from the card image",
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/wolv.json quantity/deck_limit (full printed quantity for each). The list totals 41 player cards (legal, 40-50).",
    },
  },
];
