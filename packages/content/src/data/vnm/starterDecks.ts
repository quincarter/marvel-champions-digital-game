// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/vnm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/vnm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/vnm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack vnm [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const VNM_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("venom-justice"),
    name: "Venom (Justice) — starter deck",
    packCode: setCode("vnm"),
    identityCardId: cardId("20001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("20002"), quantity: 2 },
      { cardId: cardId("20003"), quantity: 2 },
      { cardId: cardId("20004"), quantity: 1 },
      { cardId: cardId("20005"), quantity: 3 },
      { cardId: cardId("20006"), quantity: 2 },
      { cardId: cardId("20007"), quantity: 1 },
      { cardId: cardId("20008"), quantity: 1 },
      { cardId: cardId("20009"), quantity: 1 },
      { cardId: cardId("20010"), quantity: 2 },
      { cardId: cardId("20011"), quantity: 1 },
      { cardId: cardId("20012"), quantity: 3 },
      { cardId: cardId("20013"), quantity: 3 },
      { cardId: cardId("20014"), quantity: 2 },
      { cardId: cardId("20015"), quantity: 3 },
      { cardId: cardId("20016"), quantity: 1 },
      { cardId: cardId("20017"), quantity: 1 },
      { cardId: cardId("20018"), quantity: 1 },
      { cardId: cardId("20019"), quantity: 1 },
      { cardId: cardId("20020"), quantity: 3 },
      { cardId: cardId("20021"), quantity: 3 },
      { cardId: cardId("20022"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes Venom release page (https://hallofheroeslcg.com/venom/), \"Starter Deck\" link: https://hallofheroeslcg.com/wp-content/uploads/2021/07/starterdeck.jpg — image transcribed directly (card-data-pipeline, wave 3).",
      ],
      note: "40 cards = 15 Venom + 12 Justice + 13 Basic, matching the printed deck-list card's own counts. Nemesis set (Klyntar Frenzy, Enraged Symbiote x4) matches docs/phase7-wave3.md §2.1's independently-researched table.",
    },
  },
];
