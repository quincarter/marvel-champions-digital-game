// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/iron_fist (fetched 2026-11-25; raw cache: packages/content/raw/marvelcdb/iron_fist.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iron_fist.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iron_fist [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const IRON_FIST_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("iron-fist-protection"),
    name: "Iron Fist (Protection) — Iron Fist Hero Pack starter deck",
    packCode: setCode("iron_fist"),
    identityCardId: cardId("64001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("64002"), quantity: 3 },
      { cardId: cardId("64003"), quantity: 1 },
      { cardId: cardId("64004"), quantity: 2 },
      { cardId: cardId("64005"), quantity: 2 },
      { cardId: cardId("64006"), quantity: 1 },
      { cardId: cardId("64007"), quantity: 1 },
      { cardId: cardId("64008"), quantity: 1 },
      { cardId: cardId("64009"), quantity: 1 },
      { cardId: cardId("64010"), quantity: 1 },
      { cardId: cardId("64011"), quantity: 1 },
      { cardId: cardId("64012"), quantity: 1 },
      { cardId: cardId("64013"), quantity: 1 },
      { cardId: cardId("64014"), quantity: 1 },
      { cardId: cardId("64015"), quantity: 3 },
      { cardId: cardId("64016"), quantity: 3 },
      { cardId: cardId("64017"), quantity: 1 },
      { cardId: cardId("64018"), quantity: 3 },
      { cardId: cardId("64019"), quantity: 3 },
      { cardId: cardId("64020"), quantity: 3 },
      { cardId: cardId("64021"), quantity: 1 },
      { cardId: cardId("64022"), quantity: 1 },
      { cardId: cardId("64023"), quantity: 3 },
      { cardId: cardId("64024"), quantity: 1 },
      { cardId: cardId("64025"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Owner-confirmed precon (Quin, 2026-11-26: the list matches the starter deck cards; treat it as the precon). no decklist card or insert page for Iron Fist is available. Counts follow MarvelCDB public decklist 69859 (\"Iron Fist - precon deck\", posted 2026-11-16, \"precon deck for the Iron Fist (protection aspect)\"). Every copy count is within the record's quantity. The owner will supply the printed list later.",
      ],
      note: "40 cards. Confirmed by the owner against the starter deck cards (2026-11-26).",
    },
  },
];
