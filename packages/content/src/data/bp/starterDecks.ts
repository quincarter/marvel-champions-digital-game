// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/bp (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/bp.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/bp.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack bp [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const BP_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("bp-justice"),
    name: "Black Panther (Justice) — Black Panther Hero Pack starter deck",
    packCode: setCode("bp"),
    identityCardId: cardId("51001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("51002"), quantity: 1 },
      { cardId: cardId("51003"), quantity: 2 },
      { cardId: cardId("51004"), quantity: 2 },
      { cardId: cardId("51005"), quantity: 1 },
      { cardId: cardId("51006"), quantity: 2 },
      { cardId: cardId("51007"), quantity: 1 },
      { cardId: cardId("51008"), quantity: 1 },
      { cardId: cardId("51009"), quantity: 1 },
      { cardId: cardId("51010"), quantity: 1 },
      { cardId: cardId("51011"), quantity: 1 },
      { cardId: cardId("51012"), quantity: 1 },
      { cardId: cardId("51013"), quantity: 1 },
      { cardId: cardId("51014"), quantity: 1 },
      { cardId: cardId("51015"), quantity: 3 },
      { cardId: cardId("51016"), quantity: 1 },
      { cardId: cardId("51017"), quantity: 1 },
      { cardId: cardId("51018"), quantity: 1 },
      { cardId: cardId("51019"), quantity: 3 },
      { cardId: cardId("51020"), quantity: 3 },
      { cardId: cardId("51021"), quantity: 3 },
      { cardId: cardId("51022"), quantity: 1 },
      { cardId: cardId("51023"), quantity: 1 },
      { cardId: cardId("51024"), quantity: 1 },
      { cardId: cardId("51025"), quantity: 1 },
      { cardId: cardId("51026"), quantity: 1 },
      { cardId: cardId("51027"), quantity: 1 },
      { cardId: cardId("51028"), quantity: 1 },
      { cardId: cardId("51029"), quantity: 1 },
      { cardId: cardId("51030"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes \"Starter Deck\" decklist card image for this pack (wp-content/uploads/2026/01), read card by card and transcribed in docs/phase7-wave9-data-survey.md section 6.2",
      ],
      note: "40 cards by script: 15 Black Panther hero cards, the justice aspect cards and basic cards from the printed decklist (identity, obligation and nemesis set excluded). Printed card numbers equal the codes' last digits. Copies come from raw/marvelcdb/bp.json quantities except where the deck prints fewer than the pack contains.",
    },
  },
];
