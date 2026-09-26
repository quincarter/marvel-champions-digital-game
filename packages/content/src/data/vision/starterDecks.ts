// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/vision (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/vision.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/vision.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack vision [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const VISION_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("vision-protection"),
    name: "Vision (Protection) — starter deck",
    packCode: setCode("vision"),
    identityCardId: cardId("26001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("26002"), quantity: 1 },
      { cardId: cardId("26003"), quantity: 1 },
      { cardId: cardId("26004"), quantity: 1 },
      { cardId: cardId("26005"), quantity: 1 },
      { cardId: cardId("26006"), quantity: 1 },
      { cardId: cardId("26007"), quantity: 2 },
      { cardId: cardId("26008"), quantity: 3 },
      { cardId: cardId("26009"), quantity: 2 },
      { cardId: cardId("26010"), quantity: 2 },
      { cardId: cardId("26011"), quantity: 1 },
      { cardId: cardId("26012"), quantity: 1 },
      { cardId: cardId("26013"), quantity: 1 },
      { cardId: cardId("26014"), quantity: 1 },
      { cardId: cardId("26015"), quantity: 1 },
      { cardId: cardId("26016"), quantity: 3 },
      { cardId: cardId("26017"), quantity: 2 },
      { cardId: cardId("26018"), quantity: 3 },
      { cardId: cardId("26019"), quantity: 3 },
      { cardId: cardId("26020"), quantity: 2 },
      { cardId: cardId("26021"), quantity: 1 },
      { cardId: cardId("26022"), quantity: 1 },
      { cardId: cardId("26023"), quantity: 1 },
      { cardId: cardId("26024"), quantity: 3 },
      { cardId: cardId("26025"), quantity: 1 },
      { cardId: cardId("26026"), quantity: 1 },
      { cardId: cardId("26027"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes Vision release page (https://hallofheroeslcg.com/vision/), \"Starter Deck\" link: https://hallofheroeslcg.com/wp-content/uploads/2022/01/vision-starter.jpg — image transcribed directly (card-data-pipeline, wave 4).",
        "MarvelCDB public API card records for the vision pack (packages/content/raw/marvelcdb/vision.json) — every card's quantityInSet/deckLimit matches the transcribed deck exactly.",
        "MarvelCDB community decklist \"Vision - Precon\" (https://marvelcdb.com/decklist/view/16198/vision-precon-1.0, public API https://marvelcdb.com/api/public/decklist/16198) — independently reproduces the same 25 card codes at the same quantities (sum 41), corroborating the Hall of Heroes transcription.",
      ],
      note: "41 cards = 16 Vision + 17 Protection + 8 Basic. Nemesis set (Ultron minion, Ultron Unleashed, Ultron Drones environment, Relentless Android x2) matches the identity's own nemesisEncounterSetId.",
    },
  },
];
