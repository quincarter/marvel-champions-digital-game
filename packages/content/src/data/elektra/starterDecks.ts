// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/elektra (fetched 2026-11-25; raw cache: packages/content/raw/marvelcdb/elektra.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/elektra.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack elektra [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const ELEKTRA_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("elektra-aggression"),
    name: "Elektra (Aggression) — Elektra Hero Pack starter deck",
    packCode: setCode("elektra"),
    identityCardId: cardId("63001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("63005"), quantity: 1 },
      { cardId: cardId("63006"), quantity: 2 },
      { cardId: cardId("63007"), quantity: 2 },
      { cardId: cardId("63008"), quantity: 2 },
      { cardId: cardId("63009"), quantity: 2 },
      { cardId: cardId("63010"), quantity: 1 },
      { cardId: cardId("63011"), quantity: 1 },
      { cardId: cardId("63012"), quantity: 2 },
      { cardId: cardId("63013"), quantity: 1 },
      { cardId: cardId("63014"), quantity: 1 },
      { cardId: cardId("63015"), quantity: 1 },
      { cardId: cardId("63016"), quantity: 1 },
      { cardId: cardId("63017"), quantity: 3 },
      { cardId: cardId("63018"), quantity: 3 },
      { cardId: cardId("63019"), quantity: 3 },
      { cardId: cardId("63020"), quantity: 3 },
      { cardId: cardId("63021"), quantity: 3 },
      { cardId: cardId("63022"), quantity: 1 },
      { cardId: cardId("63023"), quantity: 3 },
      { cardId: cardId("63024"), quantity: 1 },
      { cardId: cardId("63025"), quantity: 1 },
      { cardId: cardId("63026"), quantity: 1 },
      { cardId: cardId("63027"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Owner-confirmed precon (Quin, 2026-11-26: the list matches the starter deck cards; treat it as the precon). no decklist card or insert page for Elektra is available (the Hall of Heroes page prints \"Starter Deck\" as plain text). Counts follow MarvelCDB public decklist 69860 (\"Elektra - precon deck\", posted 2026-11-16) and decklist 70085 (\"Elektra Precon\", posted 2026-11-21, \"Elektra's Preconstructed deck\"), which list identical slots (40 cards, aggression). Every copy count is within the record's quantity. The owner will supply the printed list later.",
      ],
      note: "40 cards: 15 Elektra, 17 Aggression, 8 basic. Confirmed by the owner against the starter deck cards (2026-11-26).",
    },
  },
];
