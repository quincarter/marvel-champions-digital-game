// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/trors (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/trors.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/trors.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack trors [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const TRORS_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("hawkeye-leadership"),
    name: "Hawkeye (Leadership) — starter deck",
    packCode: setCode("trors"),
    identityCardId: cardId("04001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("04002"), quantity: 1 },
      { cardId: cardId("04003"), quantity: 1 },
      { cardId: cardId("04004"), quantity: 1 },
      { cardId: cardId("04005"), quantity: 2 },
      { cardId: cardId("04006"), quantity: 2 },
      { cardId: cardId("04007"), quantity: 2 },
      { cardId: cardId("04008"), quantity: 2 },
      { cardId: cardId("04009"), quantity: 2 },
      { cardId: cardId("04010"), quantity: 2 },
      { cardId: cardId("04011"), quantity: 1 },
      { cardId: cardId("04012"), quantity: 1 },
      { cardId: cardId("04013"), quantity: 1 },
      { cardId: cardId("04014"), quantity: 1 },
      { cardId: cardId("04015"), quantity: 3 },
      { cardId: cardId("04016"), quantity: 3 },
      { cardId: cardId("04017"), quantity: 3 },
      { cardId: cardId("04018"), quantity: 2 },
      { cardId: cardId("04019"), quantity: 2 },
      { cardId: cardId("04020"), quantity: 1 },
      { cardId: cardId("04021"), quantity: 1 },
      { cardId: cardId("04022"), quantity: 3 },
      { cardId: cardId("04023"), quantity: 1 },
      { cardId: cardId("04024"), quantity: 1 },
      { cardId: cardId("04025"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: ["Red Skull rulebook (spoiler edition), p. 18, \"Hawkeye / Leadership\""],
    },
  },
  {
    id: starterDeckId("spider-woman-aggression-justice"),
    name: "Spider-Woman (Aggression & Justice) — starter deck",
    packCode: setCode("trors"),
    identityCardId: cardId("04031a"),
    aspects: ["aggression", "justice"],
    cards: [
      { cardId: cardId("04032"), quantity: 1 },
      { cardId: cardId("04033"), quantity: 2 },
      { cardId: cardId("04034"), quantity: 1 },
      { cardId: cardId("04035"), quantity: 2 },
      { cardId: cardId("04036"), quantity: 2 },
      { cardId: cardId("04037"), quantity: 2 },
      { cardId: cardId("04038"), quantity: 2 },
      { cardId: cardId("04039"), quantity: 3 },
      { cardId: cardId("04040"), quantity: 1 },
      { cardId: cardId("04041"), quantity: 2 },
      { cardId: cardId("04042"), quantity: 2 },
      { cardId: cardId("04043"), quantity: 3 },
      { cardId: cardId("04044"), quantity: 3 },
      { cardId: cardId("04045"), quantity: 1 },
      { cardId: cardId("04046"), quantity: 2 },
      { cardId: cardId("04047"), quantity: 3 },
      { cardId: cardId("04048"), quantity: 2 },
      { cardId: cardId("04049"), quantity: 3 },
      { cardId: cardId("04050"), quantity: 1 },
      { cardId: cardId("04051"), quantity: 1 },
      { cardId: cardId("04052"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: ["Red Skull rulebook (spoiler edition), p. 18, \"Spider-Woman / Aggression & Justice\""],
      note: "40 cards = 15 Spider-Woman + 11 Aggression + 11 Justice + 3 Basic, matching docs/phase7-wave2.md §2.1's own count from the rulebook text (\"15 + 11 + 11 + 3 basic resources\").",
    },
  },
];
