// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/spdr (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/spdr.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/spdr.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack spdr [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const SPDR_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("spdr-protection"),
    name: "SP//dr (Protection) — SP//dr Hero Pack starter deck",
    packCode: setCode("spdr"),
    identityCardId: cardId("31001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("31003"), quantity: 1 },
      { cardId: cardId("31004"), quantity: 3 },
      { cardId: cardId("31005"), quantity: 2 },
      { cardId: cardId("31006"), quantity: 2 },
      { cardId: cardId("31007"), quantity: 1 },
      { cardId: cardId("31008"), quantity: 1 },
      { cardId: cardId("31009"), quantity: 1 },
      { cardId: cardId("31010"), quantity: 1 },
      { cardId: cardId("31011"), quantity: 1 },
      { cardId: cardId("31012"), quantity: 1 },
      { cardId: cardId("31013"), quantity: 1 },
      { cardId: cardId("31014"), quantity: 1 },
      { cardId: cardId("31015"), quantity: 1 },
      { cardId: cardId("31016"), quantity: 3 },
      { cardId: cardId("31017"), quantity: 3 },
      { cardId: cardId("31018"), quantity: 3 },
      { cardId: cardId("31019"), quantity: 3 },
      { cardId: cardId("31020"), quantity: 3 },
      { cardId: cardId("31021"), quantity: 1 },
      { cardId: cardId("31022"), quantity: 1 },
      { cardId: cardId("31023"), quantity: 3 },
      { cardId: cardId("31024"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "SP//dr Hero Pack printed decklist card, \"SP//dr Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2022/07/z1.jpg, linked from the Hall of Heroes SP//dr page, https://hallofheroeslcg.com/peni-parker-sp-dr/), transcribed 2026-09-26",
      ],
      note: "No second (MarvelCDB community decklist or rulebook) source found for this pack's precon as of this pass — single-sourced from the pack's own printed decklist card. Identity is 31001a (SP//dr Suit); the engine refuses separatedIdentity until §3.24 (docs/phase7-wave5.md §1.6).",
    },
  },
];
