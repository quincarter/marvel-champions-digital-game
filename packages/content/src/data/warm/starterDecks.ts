// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/warm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/warm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/warm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack warm [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const WARM_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("war-machine-leadership"),
    name: "War Machine (Leadership) — starter deck",
    packCode: setCode("warm"),
    identityCardId: cardId("23001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("23002"), quantity: 1 },
      { cardId: cardId("23003"), quantity: 1 },
      { cardId: cardId("23004"), quantity: 1 },
      { cardId: cardId("23005"), quantity: 2 },
      { cardId: cardId("23006"), quantity: 1 },
      { cardId: cardId("23007"), quantity: 1 },
      { cardId: cardId("23008"), quantity: 2 },
      { cardId: cardId("23009"), quantity: 2 },
      { cardId: cardId("23010"), quantity: 2 },
      { cardId: cardId("23011"), quantity: 2 },
      { cardId: cardId("23012"), quantity: 1 },
      { cardId: cardId("23013"), quantity: 1 },
      { cardId: cardId("23014"), quantity: 1 },
      { cardId: cardId("23015"), quantity: 1 },
      { cardId: cardId("23016"), quantity: 3 },
      { cardId: cardId("23017"), quantity: 3 },
      { cardId: cardId("23018"), quantity: 3 },
      { cardId: cardId("23019"), quantity: 3 },
      { cardId: cardId("23020"), quantity: 2 },
      { cardId: cardId("23021"), quantity: 1 },
      { cardId: cardId("23022"), quantity: 1 },
      { cardId: cardId("23023"), quantity: 1 },
      { cardId: cardId("23024"), quantity: 1 },
      { cardId: cardId("23025"), quantity: 1 },
      { cardId: cardId("23026"), quantity: 1 },
      { cardId: cardId("23027"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes War Machine release page (https://hallofheroeslcg.com/war-machine/), \"Starter Deck\" link: https://hallofheroeslcg.com/wp-content/uploads/2021/10/wm-card.jpg — image transcribed directly (card-data-pipeline, wave 4).",
        "MarvelCDB public API card records for the warm pack (packages/content/raw/marvelcdb/warm.json) — every card's quantityInSet/deckLimit matches the transcribed deck exactly.",
      ],
      note: "40 cards = 15 War Machine + 19 Leadership + 6 Basic, matching the printed deck-list card's own counts. Nemesis set (Living Laser minion, Deadly Light Show, Laser Strike x3) matches the identity's own nemesisEncounterSetId.",
    },
  },
];
