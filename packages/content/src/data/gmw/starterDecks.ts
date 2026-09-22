// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gmw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gmw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gmw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gmw [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const GMW_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("groot-protection"),
    name: "Groot (Protection) — starter deck",
    packCode: setCode("gmw"),
    identityCardId: cardId("16001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("16002"), quantity: 2 },
      { cardId: cardId("16003"), quantity: 2 },
      { cardId: cardId("16004"), quantity: 2 },
      { cardId: cardId("16005"), quantity: 3 },
      { cardId: cardId("16006"), quantity: 1 },
      { cardId: cardId("16007"), quantity: 1 },
      { cardId: cardId("16008"), quantity: 1 },
      { cardId: cardId("16009"), quantity: 1 },
      { cardId: cardId("16010"), quantity: 1 },
      { cardId: cardId("16011"), quantity: 1 },
      { cardId: cardId("16012"), quantity: 1 },
      { cardId: cardId("16013"), quantity: 3 },
      { cardId: cardId("16014"), quantity: 3 },
      { cardId: cardId("16015"), quantity: 2 },
      { cardId: cardId("16016"), quantity: 3 },
      { cardId: cardId("16017"), quantity: 3 },
      { cardId: cardId("16018"), quantity: 2 },
      { cardId: cardId("16019"), quantity: 1 },
      { cardId: cardId("16020"), quantity: 1 },
      { cardId: cardId("16021"), quantity: 1 },
      { cardId: cardId("16022"), quantity: 1 },
      { cardId: cardId("16023"), quantity: 1 },
      { cardId: cardId("16024"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: ["MC16 p. 20, \"Starter Decks\", \"Groot / Protection\""],
      note: "40 cards = 15 Groot + 17 Protection + 8 Basic, matching the rulebook's own listed counts.",
    },
  },
  {
    id: starterDeckId("rocket-raccoon-aggression"),
    name: "Rocket Raccoon (Aggression) — starter deck",
    packCode: setCode("gmw"),
    identityCardId: cardId("16029a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("16030"), quantity: 2 },
      { cardId: cardId("16031"), quantity: 2 },
      { cardId: cardId("16032"), quantity: 1 },
      { cardId: cardId("16033"), quantity: 2 },
      { cardId: cardId("16034"), quantity: 2 },
      { cardId: cardId("16035"), quantity: 1 },
      { cardId: cardId("16036"), quantity: 1 },
      { cardId: cardId("16037"), quantity: 1 },
      { cardId: cardId("16038"), quantity: 2 },
      { cardId: cardId("16039"), quantity: 1 },
      { cardId: cardId("16040"), quantity: 1 },
      { cardId: cardId("16041"), quantity: 2 },
      { cardId: cardId("16042"), quantity: 3 },
      { cardId: cardId("16043"), quantity: 3 },
      { cardId: cardId("16044"), quantity: 2 },
      { cardId: cardId("16045"), quantity: 3 },
      { cardId: cardId("16046"), quantity: 3 },
      { cardId: cardId("16047"), quantity: 1 },
      { cardId: cardId("16048"), quantity: 1 },
      { cardId: cardId("16049"), quantity: 1 },
      { cardId: cardId("16050"), quantity: 1 },
      { cardId: cardId("16051"), quantity: 1 },
      { cardId: cardId("16052"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: ["MC16 p. 20, \"Starter Decks\", \"Rocket Raccoon / Aggression\""],
      note: "40 cards = 15 Rocket Raccoon + 17 Aggression + 8 Basic, matching the rulebook's own listed counts.",
    },
  },
];
