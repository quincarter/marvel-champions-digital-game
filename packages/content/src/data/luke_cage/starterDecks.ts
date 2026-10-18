// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/luke_cage (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/luke_cage.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/luke_cage.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack luke_cage [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const LUKE_CAGE_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("luke-cage-leadership"),
    name: "Luke Cage (Leadership) — Luke Cage Hero Pack starter deck",
    packCode: setCode("luke_cage"),
    identityCardId: cardId("62001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("62002"), quantity: 1 },
      { cardId: cardId("62003"), quantity: 2 },
      { cardId: cardId("62004"), quantity: 1 },
      { cardId: cardId("62005"), quantity: 2 },
      { cardId: cardId("62006"), quantity: 2 },
      { cardId: cardId("62007"), quantity: 1 },
      { cardId: cardId("62008"), quantity: 1 },
      { cardId: cardId("62009"), quantity: 2 },
      { cardId: cardId("62010"), quantity: 2 },
      { cardId: cardId("62011"), quantity: 1 },
      { cardId: cardId("62012"), quantity: 1 },
      { cardId: cardId("62013"), quantity: 1 },
      { cardId: cardId("62014"), quantity: 1 },
      { cardId: cardId("62015"), quantity: 3 },
      { cardId: cardId("62016"), quantity: 1 },
      { cardId: cardId("62017"), quantity: 2 },
      { cardId: cardId("62018"), quantity: 3 },
      { cardId: cardId("62019"), quantity: 3 },
      { cardId: cardId("62020"), quantity: 1 },
      { cardId: cardId("62021"), quantity: 1 },
      { cardId: cardId("62022"), quantity: 3 },
      { cardId: cardId("62023"), quantity: 1 },
      { cardId: cardId("62024"), quantity: 1 },
      { cardId: cardId("62025"), quantity: 1 },
      { cardId: cardId("62026"), quantity: 1 },
      { cardId: cardId("62027"), quantity: 1 },
    ],
    provenance: {
      verified: false,
      sources: [
        "STAND-IN, NOT A PRINTED LIST: no decklist card or insert page for Luke Cage is available (the Hall of Heroes page prints \"Starter Deck\" as plain text; the MC62 insert has no list). Counts follow MarvelCDB public decklist 65136 (\"Luke Cage - precon deck\", posted 2026-08-21), as tabulated in docs/phase7-wave11-data-survey.md section 10. Every copy count is within the record's quantity. Replace with the printed list when the owner supplies it.",
      ],
      note: "40 cards. Unverified against the printed card.",
    },
  },
];
