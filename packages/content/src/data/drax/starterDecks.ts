// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/drax (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/drax.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/drax.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack drax [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const DRAX_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("drax-protection"),
    name: "Drax (Protection) — starter deck",
    packCode: setCode("drax"),
    identityCardId: cardId("19001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("19002"), quantity: 1 },
      { cardId: cardId("19003"), quantity: 2 },
      { cardId: cardId("19004"), quantity: 2 },
      { cardId: cardId("19005"), quantity: 2 },
      { cardId: cardId("19006"), quantity: 2 },
      { cardId: cardId("19007"), quantity: 2 },
      { cardId: cardId("19008"), quantity: 1 },
      { cardId: cardId("19009"), quantity: 1 },
      { cardId: cardId("19010"), quantity: 1 },
      { cardId: cardId("19011"), quantity: 1 },
      { cardId: cardId("19012"), quantity: 1 },
      { cardId: cardId("19013"), quantity: 1 },
      { cardId: cardId("19014"), quantity: 2 },
      { cardId: cardId("19015"), quantity: 3 },
      { cardId: cardId("19016"), quantity: 3 },
      { cardId: cardId("19017"), quantity: 3 },
      { cardId: cardId("19018"), quantity: 3 },
      { cardId: cardId("19019"), quantity: 2 },
      { cardId: cardId("19020"), quantity: 1 },
      { cardId: cardId("19021"), quantity: 3 },
      { cardId: cardId("19022"), quantity: 1 },
      { cardId: cardId("19023"), quantity: 1 },
      { cardId: cardId("19024"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes Drax release page (https://hallofheroeslcg.com/drax-2/), \"Starter Deck\" link: https://hallofheroeslcg.com/wp-content/uploads/2021/06/drax.jpg — image transcribed directly (card-data-pipeline, wave 3).",
      ],
      note: "40 cards = 15 Drax + 18 Protection + 7 Basic, matching the printed deck-list card's own counts. Nemesis set (Cull the Weak, Yotat the Destroyer, Challenge Accepted, \"I Will Destroy You!\" x2) matches docs/phase7-wave3.md §2.1's independently-researched table.",
    },
  },
];
