// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/cyclops (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/cyclops.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/cyclops.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack cyclops [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const CYCLOPS_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("cyclops-leadership"),
    name: "Cyclops (Leadership) — Cyclops Hero Pack starter deck",
    packCode: setCode("cyclops"),
    identityCardId: cardId("33001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("33002"), quantity: 1 },
      { cardId: cardId("33003"), quantity: 1 },
      { cardId: cardId("33004"), quantity: 1 },
      { cardId: cardId("33005"), quantity: 2 },
      { cardId: cardId("33006"), quantity: 2 },
      { cardId: cardId("33007"), quantity: 2 },
      { cardId: cardId("33008"), quantity: 1 },
      { cardId: cardId("33009"), quantity: 2 },
      { cardId: cardId("33010"), quantity: 3 },
      { cardId: cardId("33011"), quantity: 1 },
      { cardId: cardId("33012"), quantity: 1 },
      { cardId: cardId("33013"), quantity: 1 },
      { cardId: cardId("33014"), quantity: 1 },
      { cardId: cardId("33015"), quantity: 3 },
      { cardId: cardId("33016"), quantity: 3 },
      { cardId: cardId("33017"), quantity: 3 },
      { cardId: cardId("33018"), quantity: 2 },
      { cardId: cardId("33019"), quantity: 1 },
      { cardId: cardId("33020"), quantity: 1 },
      { cardId: cardId("33021"), quantity: 1 },
      { cardId: cardId("33022"), quantity: 3 },
      { cardId: cardId("33023"), quantity: 1 },
      { cardId: cardId("33024"), quantity: 1 },
      { cardId: cardId("33025"), quantity: 1 },
      { cardId: cardId("33026"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Cyclops Hero Pack printed decklist card, \"Cyclops Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2022/09/c1-1.jpg, the \"Starter Deck\" link on the Hall of Heroes Cyclops page, https://hallofheroeslcg.com/scott-summers-cyclops/), transcribed 2026-10-01",
      ],
      note: "Single printed source (no MarvelCDB decklist found); every code and quantity cross-checked against raw/marvelcdb/cyclops.json quantity/deck_limit (full printed quantity for each). Dust, Rockslide and Blindfold are aggression, protection and justice X-Men allies admitted by Cyclops' own deck options; the card lists all three as Leadership + Aspect cards.",
    },
  },
];
