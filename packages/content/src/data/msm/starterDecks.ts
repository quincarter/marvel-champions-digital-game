// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/msm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/msm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/msm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack msm [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const MSM_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("msm-protection"),
    name: "Ms. Marvel (Protection) — Hero Pack starter deck",
    packCode: setCode("msm"),
    identityCardId: cardId("05001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("05002"), quantity: 1 },
      { cardId: cardId("05003"), quantity: 3 },
      { cardId: cardId("05004"), quantity: 3 },
      { cardId: cardId("05005"), quantity: 2 },
      { cardId: cardId("05006"), quantity: 1 },
      { cardId: cardId("05007"), quantity: 1 },
      { cardId: cardId("05008"), quantity: 1 },
      { cardId: cardId("05009"), quantity: 1 },
      { cardId: cardId("05010"), quantity: 1 },
      { cardId: cardId("05011"), quantity: 1 },
      { cardId: cardId("05012"), quantity: 1 },
      { cardId: cardId("05013"), quantity: 2 },
      { cardId: cardId("05014"), quantity: 3 },
      { cardId: cardId("05015"), quantity: 3 },
      { cardId: cardId("05016"), quantity: 2 },
      { cardId: cardId("05017"), quantity: 3 },
      { cardId: cardId("05018"), quantity: 1 },
      { cardId: cardId("05019"), quantity: 1 },
      { cardId: cardId("05020"), quantity: 1 },
      { cardId: cardId("05021"), quantity: 1 },
      { cardId: cardId("05022"), quantity: 1 },
      { cardId: cardId("05023"), quantity: 3 },
      { cardId: cardId("05024"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Ms. Marvel Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2019/12/msmarvelstarterdeck.jpg, linked from https://hallofheroeslcg.com/ms-marvel/)",
      ],
    },
  },
];
