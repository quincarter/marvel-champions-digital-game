// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/falcon (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/falcon.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/falcon.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack falcon [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const FALCON_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("falcon-leadership"),
    name: "Falcon (Leadership) — Falcon Hero Pack starter deck",
    packCode: setCode("falcon"),
    identityCardId: cardId("53001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("53002"), quantity: 1 },
      { cardId: cardId("53003"), quantity: 2 },
      { cardId: cardId("53004"), quantity: 2 },
      { cardId: cardId("53005"), quantity: 2 },
      { cardId: cardId("53006"), quantity: 1 },
      { cardId: cardId("53007"), quantity: 1 },
      { cardId: cardId("53008"), quantity: 1 },
      { cardId: cardId("53009"), quantity: 1 },
      { cardId: cardId("53010"), quantity: 1 },
      { cardId: cardId("53011"), quantity: 1 },
      { cardId: cardId("53012"), quantity: 1 },
      { cardId: cardId("53013"), quantity: 1 },
      { cardId: cardId("53014"), quantity: 1 },
      { cardId: cardId("53015"), quantity: 1 },
      { cardId: cardId("53016"), quantity: 1 },
      { cardId: cardId("53017"), quantity: 1 },
      { cardId: cardId("53018"), quantity: 1 },
      { cardId: cardId("53019"), quantity: 3 },
      { cardId: cardId("53020"), quantity: 3 },
      { cardId: cardId("53021"), quantity: 3 },
      { cardId: cardId("53022"), quantity: 1 },
      { cardId: cardId("53023"), quantity: 1 },
      { cardId: cardId("53024"), quantity: 3 },
      { cardId: cardId("53025"), quantity: 1 },
      { cardId: cardId("53026"), quantity: 1 },
      { cardId: cardId("53027"), quantity: 1 },
      { cardId: cardId("53028"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes \"Starter Deck\" decklist card image for this pack (wp-content/uploads/2026/01), read card by card and transcribed in docs/phase7-wave9-data-survey.md section 6.2",
      ],
      note: "40 cards by script: 15 Falcon hero cards, the leadership aspect cards and basic cards from the printed decklist (identity, obligation and nemesis set excluded). Printed card numbers equal the codes' last digits. Copies come from raw/marvelcdb/falcon.json quantities except where the deck prints fewer than the pack contains.",
    },
  },
];
