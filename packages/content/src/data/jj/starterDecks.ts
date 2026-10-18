// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/jj (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/jj.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/jj.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack jj [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const JJ_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("jj-justice"),
    name: "Jessica Jones (Justice) — Jessica Jones Hero Pack starter deck",
    packCode: setCode("jj"),
    identityCardId: cardId("61001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("61002"), quantity: 1 },
      { cardId: cardId("61003"), quantity: 1 },
      { cardId: cardId("61004"), quantity: 2 },
      { cardId: cardId("61005"), quantity: 1 },
      { cardId: cardId("61006"), quantity: 3 },
      { cardId: cardId("61007"), quantity: 1 },
      { cardId: cardId("61008"), quantity: 1 },
      { cardId: cardId("61009"), quantity: 1 },
      { cardId: cardId("61010"), quantity: 1 },
      { cardId: cardId("61011"), quantity: 1 },
      { cardId: cardId("61012"), quantity: 1 },
      { cardId: cardId("61013"), quantity: 1 },
      { cardId: cardId("61014"), quantity: 1 },
      { cardId: cardId("61015"), quantity: 1 },
      { cardId: cardId("61016"), quantity: 1 },
      { cardId: cardId("61017"), quantity: 1 },
      { cardId: cardId("61018"), quantity: 3 },
      { cardId: cardId("61019"), quantity: 3 },
      { cardId: cardId("61020"), quantity: 1 },
      { cardId: cardId("61021"), quantity: 1 },
      { cardId: cardId("61022"), quantity: 1 },
      { cardId: cardId("61023"), quantity: 3 },
      { cardId: cardId("61024"), quantity: 3 },
      { cardId: cardId("61025"), quantity: 1 },
      { cardId: cardId("61026"), quantity: 3 },
      { cardId: cardId("61027"), quantity: 1 },
      { cardId: cardId("61028"), quantity: 1 },
      { cardId: cardId("61029"), quantity: 1 },
    ],
    provenance: {
      verified: false,
      sources: [
        "STAND-IN, NOT A PRINTED LIST: no decklist card or insert page for Jessica Jones is available (the Hall of Heroes page prints \"Starter Deck\" as plain text; the MC61 insert has no list). Counts follow MarvelCDB public decklist 65137 (\"Jessica Jones precon deck\", posted 2026-08-21), as tabulated in docs/phase7-wave11-data-survey.md section 10. Every copy count is within the record's quantity. Replace with the printed list when the owner supplies it.",
      ],
      note: "41 entries: the 40-card listing plus the Permanent Alias Investigations (61002), which Setup puts into play (the Wonder Man rule). Unverified against the printed card.",
    },
  },
];
