// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/silk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/silk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/silk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack silk [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const SILK_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("silk-protection"),
    name: "Silk (Protection) — Silk Hero Pack starter deck",
    packCode: setCode("silk"),
    identityCardId: cardId("52001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("52002"), quantity: 2 },
      { cardId: cardId("52003"), quantity: 3 },
      { cardId: cardId("52004"), quantity: 2 },
      { cardId: cardId("52005"), quantity: 1 },
      { cardId: cardId("52006"), quantity: 1 },
      { cardId: cardId("52007"), quantity: 1 },
      { cardId: cardId("52008"), quantity: 1 },
      { cardId: cardId("52009"), quantity: 1 },
      { cardId: cardId("52010"), quantity: 1 },
      { cardId: cardId("52011"), quantity: 1 },
      { cardId: cardId("52012"), quantity: 1 },
      { cardId: cardId("52013"), quantity: 1 },
      { cardId: cardId("52014"), quantity: 1 },
      { cardId: cardId("52015"), quantity: 3 },
      { cardId: cardId("52016"), quantity: 3 },
      { cardId: cardId("52017"), quantity: 1 },
      { cardId: cardId("52018"), quantity: 3 },
      { cardId: cardId("52019"), quantity: 3 },
      { cardId: cardId("52020"), quantity: 3 },
      { cardId: cardId("52021"), quantity: 1 },
      { cardId: cardId("52022"), quantity: 1 },
      { cardId: cardId("52023"), quantity: 1 },
      { cardId: cardId("52024"), quantity: 1 },
      { cardId: cardId("52025"), quantity: 1 },
      { cardId: cardId("52026"), quantity: 1 },
      { cardId: cardId("52027"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes \"Starter Deck\" decklist card image for this pack (wp-content/uploads/2026/01), read card by card and transcribed in docs/phase7-wave9-data-survey.md section 6.2",
      ],
      note: "40 cards by script: 15 Silk hero cards, the protection aspect cards and basic cards from the printed decklist (identity, obligation and nemesis set excluded). Printed card numbers equal the codes' last digits. Copies come from raw/marvelcdb/silk.json quantities except where the deck prints fewer than the pack contains.",
    },
  },
];
