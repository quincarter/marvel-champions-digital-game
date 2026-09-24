// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/nebu (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/nebu.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/nebu.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack nebu [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const NEBU_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("nebula-justice"),
    name: "Nebula (Justice) — starter deck",
    packCode: setCode("nebu"),
    identityCardId: cardId("22001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("22002"), quantity: 1 },
      { cardId: cardId("22003"), quantity: 1 },
      { cardId: cardId("22004"), quantity: 2 },
      { cardId: cardId("22005"), quantity: 1 },
      { cardId: cardId("22006"), quantity: 1 },
      { cardId: cardId("22007"), quantity: 2 },
      { cardId: cardId("22008"), quantity: 2 },
      { cardId: cardId("22009"), quantity: 2 },
      { cardId: cardId("22010"), quantity: 3 },
      { cardId: cardId("22011"), quantity: 1 },
      { cardId: cardId("22012"), quantity: 1 },
      { cardId: cardId("22013"), quantity: 1 },
      { cardId: cardId("22014"), quantity: 3 },
      { cardId: cardId("22015"), quantity: 3 },
      { cardId: cardId("22016"), quantity: 1 },
      { cardId: cardId("22017"), quantity: 2 },
      { cardId: cardId("22018"), quantity: 3 },
      { cardId: cardId("22019"), quantity: 2 },
      { cardId: cardId("22020"), quantity: 1 },
      { cardId: cardId("22021"), quantity: 1 },
      { cardId: cardId("22022"), quantity: 1 },
      { cardId: cardId("22023"), quantity: 2 },
      { cardId: cardId("22024"), quantity: 1 },
      { cardId: cardId("22025"), quantity: 1 },
      { cardId: cardId("22026"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes Nebula release page (https://hallofheroeslcg.com/nebula/), \"Starter Deck\" link: https://hallofheroeslcg.com/wp-content/uploads/2021/09/nebula-starter-deck.jpg — image transcribed directly (card-data-pipeline, wave 4).",
        "MarvelCDB public API card records for the nebu pack (packages/content/raw/marvelcdb/nebu.json) — cross-checked every card's quantityInSet/deckLimit against the transcribed deck (see the 22017 correction above for the one mismatch found).",
      ],
      note: "40 cards = 15 Nebula + 17 Justice + 8 Basic, matching the printed deck-list card's own counts. Nemesis set (Gamora minion, Self-Preservation, Lethal Weapon, Old Rivals x2) matches the identity's own nemesisEncounterSetId.",
    },
  },
];
