// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/x23 (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/x23.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/x23.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack x23 [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const X23_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("x-23-aggression"),
    name: "X-23 (Aggression) — X-23 Hero Pack starter deck",
    packCode: setCode("x23"),
    identityCardId: cardId("43001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("43002"), quantity: 1 },
      { cardId: cardId("43003"), quantity: 1 },
      { cardId: cardId("43004"), quantity: 2 },
      { cardId: cardId("43005"), quantity: 3 },
      { cardId: cardId("43006"), quantity: 2 },
      { cardId: cardId("43007"), quantity: 1 },
      { cardId: cardId("43008"), quantity: 1 },
      { cardId: cardId("43009"), quantity: 1 },
      { cardId: cardId("43010"), quantity: 1 },
      { cardId: cardId("43011"), quantity: 1 },
      { cardId: cardId("43012"), quantity: 2 },
      { cardId: cardId("43013"), quantity: 1 },
      { cardId: cardId("43014"), quantity: 1 },
      { cardId: cardId("43015"), quantity: 1 },
      { cardId: cardId("43016"), quantity: 3 },
      { cardId: cardId("43017"), quantity: 3 },
      { cardId: cardId("43018"), quantity: 1 },
      { cardId: cardId("43019"), quantity: 3 },
      { cardId: cardId("43020"), quantity: 3 },
      { cardId: cardId("43021"), quantity: 1 },
      { cardId: cardId("43022"), quantity: 1 },
      { cardId: cardId("43023"), quantity: 1 },
      { cardId: cardId("43024"), quantity: 1 },
      { cardId: cardId("43025"), quantity: 1 },
      { cardId: cardId("43026"), quantity: 1 },
      { cardId: cardId("43027"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: ["X-23 Hero Pack printed decklist card, \"X-23 Deck\" (photo supplied by the owner, 2026-10-04)"],
      note: "41 cards (identity, obligation and nemesis set excluded): 16 X-23 (X-23's Claws 43002 is Permanent), 16 Aggression, 9 basic. Read from the pack's printed decklist card (the owner's photo, 2026-10-04): entries 2-27 with the quantities here; it lists the four Specialist upgrades (43034-43037) apart, under \"Linked Cards\", so they are not in the deck. 43038-43040 (the other aspects' cards) are not on the decklist card.",
    },
  },
];
