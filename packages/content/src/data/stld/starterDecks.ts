// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/stld (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/stld.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/stld.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack stld [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const STLD_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("star-lord-leadership"),
    name: "Star-Lord (Leadership) — starter deck",
    packCode: setCode("stld"),
    identityCardId: cardId("17001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("17002"), quantity: 1 },
      { cardId: cardId("17003"), quantity: 3 },
      { cardId: cardId("17004"), quantity: 2 },
      { cardId: cardId("17005"), quantity: 3 },
      { cardId: cardId("17006"), quantity: 1 },
      { cardId: cardId("17007"), quantity: 2 },
      { cardId: cardId("17008"), quantity: 1 },
      { cardId: cardId("17009"), quantity: 1 },
      { cardId: cardId("17010"), quantity: 1 },
      { cardId: cardId("17011"), quantity: 1 },
      { cardId: cardId("17012"), quantity: 1 },
      { cardId: cardId("17013"), quantity: 1 },
      { cardId: cardId("17014"), quantity: 3 },
      { cardId: cardId("17015"), quantity: 3 },
      { cardId: cardId("17016"), quantity: 2 },
      { cardId: cardId("17017"), quantity: 3 },
      { cardId: cardId("17018"), quantity: 2 },
      { cardId: cardId("17019"), quantity: 3 },
      { cardId: cardId("17020"), quantity: 1 },
      { cardId: cardId("17021"), quantity: 1 },
      { cardId: cardId("17022"), quantity: 1 },
      { cardId: cardId("17023"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes Star-Lord release page (https://hallofheroeslcg.com/peter-quill-star-lord/), \"Starter Deck\" link: https://hallofheroeslcg.com/wp-content/uploads/2021/05/starlorddeck.jpg — image transcribed directly (card-data-pipeline, wave 3).",
      ],
      note: "40 cards = 15 Star-Lord + 19 Leadership + 6 Basic, matching the printed deck-list card's own counts. Nemesis set (Budding Crime Syndicate, Mister Knife, Spartoi Cunning x3) matches docs/phase7-wave3.md §2.1's independently-researched table.",
    },
  },
];
