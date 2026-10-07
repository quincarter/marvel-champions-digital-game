// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/magneto (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/magneto.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/magneto.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack magneto [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const MAGNETO_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("magneto-leadership"),
    name: "Magneto (Leadership) — Magneto Hero Pack starter deck",
    packCode: setCode("magneto"),
    identityCardId: cardId("49001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("49002"), quantity: 1 },
      { cardId: cardId("49003"), quantity: 1 },
      { cardId: cardId("49004"), quantity: 1 },
      { cardId: cardId("49005"), quantity: 1 },
      { cardId: cardId("49006"), quantity: 1 },
      { cardId: cardId("49007"), quantity: 2 },
      { cardId: cardId("49008"), quantity: 2 },
      { cardId: cardId("49009"), quantity: 2 },
      { cardId: cardId("49010"), quantity: 2 },
      { cardId: cardId("49011"), quantity: 2 },
      { cardId: cardId("49012"), quantity: 1 },
      { cardId: cardId("49013"), quantity: 1 },
      { cardId: cardId("49014"), quantity: 1 },
      { cardId: cardId("49015"), quantity: 1 },
      { cardId: cardId("49016"), quantity: 3 },
      { cardId: cardId("49017"), quantity: 3 },
      { cardId: cardId("49018"), quantity: 3 },
      { cardId: cardId("49019"), quantity: 3 },
      { cardId: cardId("49020"), quantity: 1 },
      { cardId: cardId("49021"), quantity: 1 },
      { cardId: cardId("49022"), quantity: 1 },
      { cardId: cardId("49023"), quantity: 3 },
      { cardId: cardId("49024"), quantity: 1 },
      { cardId: cardId("49025"), quantity: 1 },
      { cardId: cardId("49026"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Magneto Hero Pack printed decklist card, \"Magneto Deck\" (the owner's photo of the card, 2026-10-07), transcribed in docs/phase7-wave8-handoff.md",
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Magneto, 17 Leadership (New Recruits is the in-aspect player side scheme), 8 basic. Identity is 49001a. The printed card numbers equal the codes' last digits; every title and quantity matches raw/marvelcdb/magneto.json (checked by script). The nemesis set is one copy of each of 49028 to 49032 (the card prints no multiplier).",
    },
  },
];
