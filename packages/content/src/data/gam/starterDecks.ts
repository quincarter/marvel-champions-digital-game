// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gam (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gam.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gam.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gam [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const GAM_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("gamora-aggression"),
    name: "Gamora (Aggression) — starter deck",
    packCode: setCode("gam"),
    identityCardId: cardId("18001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("18002"), quantity: 1 },
      { cardId: cardId("18003"), quantity: 2 },
      { cardId: cardId("18004"), quantity: 2 },
      { cardId: cardId("18005"), quantity: 2 },
      { cardId: cardId("18006"), quantity: 2 },
      { cardId: cardId("18007"), quantity: 2 },
      { cardId: cardId("18008"), quantity: 1 },
      { cardId: cardId("18009"), quantity: 2 },
      { cardId: cardId("18010"), quantity: 1 },
      { cardId: cardId("18011"), quantity: 1 },
      { cardId: cardId("18012"), quantity: 3 },
      { cardId: cardId("18013"), quantity: 3 },
      { cardId: cardId("18014"), quantity: 2 },
      { cardId: cardId("18015"), quantity: 3 },
      { cardId: cardId("18016"), quantity: 3 },
      { cardId: cardId("18017"), quantity: 2 },
      { cardId: cardId("18018"), quantity: 1 },
      { cardId: cardId("18019"), quantity: 1 },
      { cardId: cardId("18020"), quantity: 3 },
      { cardId: cardId("18021"), quantity: 1 },
      { cardId: cardId("18022"), quantity: 1 },
      { cardId: cardId("18023"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes Gamora release page (https://hallofheroeslcg.com/gamora/), \"Starter Deck\" link: https://hallofheroeslcg.com/wp-content/uploads/2021/05/gamorastarter.jpg — image transcribed directly (card-data-pipeline, wave 3).",
      ],
      note: "40 cards = 15 Gamora + 18 Aggression (incl. the 6-card off-aspect allowance: First Hit x3/Protection, Impede x3/Justice) + 7 Basic, matching the printed deck-list card's own counts. Nemesis set (Sibling Rivalry, Nebula, In a Bind, Waylay x2) matches docs/phase7-wave3.md §2.1's independently-researched table.",
    },
  },
];
