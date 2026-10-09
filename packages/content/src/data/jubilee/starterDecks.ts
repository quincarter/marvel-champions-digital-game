// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/jubilee (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/jubilee.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/jubilee.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack jubilee [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const JUBILEE_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("jubilee-justice"),
    name: "Jubilee (Justice) — Jubilee Hero Pack starter deck",
    packCode: setCode("jubilee"),
    identityCardId: cardId("47001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("47002"), quantity: 1 },
      { cardId: cardId("47003"), quantity: 1 },
      { cardId: cardId("47004"), quantity: 1 },
      { cardId: cardId("47005"), quantity: 1 },
      { cardId: cardId("47006"), quantity: 1 },
      { cardId: cardId("47007a"), quantity: 1 },
      { cardId: cardId("47007b"), quantity: 1 },
      { cardId: cardId("47007c"), quantity: 1 },
      { cardId: cardId("47008a"), quantity: 1 },
      { cardId: cardId("47008b"), quantity: 1 },
      { cardId: cardId("47008c"), quantity: 1 },
      { cardId: cardId("47009"), quantity: 1 },
      { cardId: cardId("47010a"), quantity: 1 },
      { cardId: cardId("47010b"), quantity: 1 },
      { cardId: cardId("47010c"), quantity: 1 },
      { cardId: cardId("47011"), quantity: 1 },
      { cardId: cardId("47012"), quantity: 1 },
      { cardId: cardId("47013"), quantity: 3 },
      { cardId: cardId("47014"), quantity: 3 },
      { cardId: cardId("47015"), quantity: 3 },
      { cardId: cardId("47016"), quantity: 1 },
      { cardId: cardId("47017"), quantity: 2 },
      { cardId: cardId("47018"), quantity: 1 },
      { cardId: cardId("47019"), quantity: 3 },
      { cardId: cardId("47020"), quantity: 3 },
      { cardId: cardId("47021"), quantity: 3 },
      { cardId: cardId("47022"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Jubilee Hero Pack printed decklist card, \"Jubilee Deck\" (the owner's photo of the card, 2026-10-07), transcribed in docs/phase7-wave8-handoff.md",
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Jubilee, 14 Justice, 11 basic. Identity is 47001a. Firecracker (47007), Flash of Light (47008) and Plasmoid Energy (47010) are printed x3 and MarvelCDB stores each as three one-copy records (a/b/c, three versions of the card), so the deck holds one copy of each of the nine records. Unlikely Duo (47022) is one copy as printed (Max 1 per deck; MarvelCDB's raw quantity of 2 is the pack count). The printed card numbers equal the codes' last digits; every other title and quantity matches raw/marvelcdb/jubilee.json.",
    },
  },
];
