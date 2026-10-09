// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ncrawler (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ncrawler.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ncrawler.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ncrawler [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const NCRAWLER_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("nightcrawler-protection"),
    name: "Nightcrawler (Protection) — Nightcrawler Hero Pack starter deck",
    packCode: setCode("ncrawler"),
    identityCardId: cardId("48001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("48002"), quantity: 1 },
      { cardId: cardId("48003"), quantity: 1 },
      { cardId: cardId("48004"), quantity: 1 },
      { cardId: cardId("48005"), quantity: 1 },
      { cardId: cardId("48006"), quantity: 3 },
      { cardId: cardId("48007"), quantity: 2 },
      { cardId: cardId("48008"), quantity: 1 },
      { cardId: cardId("48009"), quantity: 2 },
      { cardId: cardId("48010"), quantity: 1 },
      { cardId: cardId("48011"), quantity: 2 },
      { cardId: cardId("48012"), quantity: 1 },
      { cardId: cardId("48013"), quantity: 1 },
      { cardId: cardId("48014"), quantity: 3 },
      { cardId: cardId("48015"), quantity: 3 },
      { cardId: cardId("48016"), quantity: 3 },
      { cardId: cardId("48017"), quantity: 3 },
      { cardId: cardId("48018"), quantity: 3 },
      { cardId: cardId("48019"), quantity: 2 },
      { cardId: cardId("48020"), quantity: 1 },
      { cardId: cardId("48021"), quantity: 1 },
      { cardId: cardId("48022"), quantity: 1 },
      { cardId: cardId("48023"), quantity: 1 },
      { cardId: cardId("48024"), quantity: 1 },
      { cardId: cardId("48025"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Nightcrawler Hero Pack printed decklist card, \"Nightcrawler Deck\" (the owner's photo of the card, 2026-10-07), transcribed in docs/phase7-wave8-handoff.md",
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Nightcrawler, 20 Protection (Astonishing X-Men is the in-aspect player side scheme), 5 basic. Identity is 48001a. The printed card numbers equal the codes' last digits; every title and quantity matches raw/marvelcdb/ncrawler.json (checked by script).",
    },
  },
];
