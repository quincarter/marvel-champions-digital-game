// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/winter (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/winter.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/winter.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack winter [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const WINTER_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("winter-aggression"),
    name: "Winter Soldier (Aggression) — Winter Soldier Hero Pack starter deck",
    packCode: setCode("winter"),
    identityCardId: cardId("54001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("54002"), quantity: 1 },
      { cardId: cardId("54003"), quantity: 1 },
      { cardId: cardId("54004"), quantity: 2 },
      { cardId: cardId("54005"), quantity: 3 },
      { cardId: cardId("54006"), quantity: 2 },
      { cardId: cardId("54007"), quantity: 1 },
      { cardId: cardId("54008"), quantity: 2 },
      { cardId: cardId("54009"), quantity: 1 },
      { cardId: cardId("54010"), quantity: 1 },
      { cardId: cardId("54011"), quantity: 1 },
      { cardId: cardId("54012"), quantity: 1 },
      { cardId: cardId("54013"), quantity: 1 },
      { cardId: cardId("54014"), quantity: 3 },
      { cardId: cardId("54015"), quantity: 3 },
      { cardId: cardId("54016"), quantity: 3 },
      { cardId: cardId("54017"), quantity: 3 },
      { cardId: cardId("54018"), quantity: 1 },
      { cardId: cardId("54019"), quantity: 1 },
      { cardId: cardId("54020"), quantity: 3 },
      { cardId: cardId("54021"), quantity: 1 },
      { cardId: cardId("54022"), quantity: 1 },
      { cardId: cardId("54023"), quantity: 1 },
      { cardId: cardId("54024"), quantity: 1 },
      { cardId: cardId("54025"), quantity: 1 },
      { cardId: cardId("54026"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes \"Starter Deck\" decklist card image for this pack (wp-content/uploads/2026/01), read card by card and transcribed in docs/phase7-wave9-data-survey.md section 6.2",
      ],
      note: "40 cards by script: 15 Winter Soldier hero cards, the aggression aspect cards and basic cards from the printed decklist (identity, obligation and nemesis set excluded). Printed card numbers equal the codes' last digits. Copies come from raw/marvelcdb/winter.json quantities except where the deck prints fewer than the pack contains.",
    },
  },
];
