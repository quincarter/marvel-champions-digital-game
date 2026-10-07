// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/psylocke (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/psylocke.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/psylocke.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack psylocke [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const PSYLOCKE_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("psylocke-justice"),
    name: "Psylocke (Justice) — Psylocke Hero Pack starter deck",
    packCode: setCode("psylocke"),
    identityCardId: cardId("41001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("41002a"), quantity: 2 },
      { cardId: cardId("41003"), quantity: 1 },
      { cardId: cardId("41004"), quantity: 3 },
      { cardId: cardId("41005"), quantity: 3 },
      { cardId: cardId("41006"), quantity: 2 },
      { cardId: cardId("41007"), quantity: 2 },
      { cardId: cardId("41008"), quantity: 1 },
      { cardId: cardId("41009"), quantity: 1 },
      { cardId: cardId("41010"), quantity: 1 },
      { cardId: cardId("41011"), quantity: 1 },
      { cardId: cardId("41012"), quantity: 1 },
      { cardId: cardId("41013"), quantity: 1 },
      { cardId: cardId("41014"), quantity: 3 },
      { cardId: cardId("41015"), quantity: 3 },
      { cardId: cardId("41016"), quantity: 1 },
      { cardId: cardId("41017"), quantity: 3 },
      { cardId: cardId("41018"), quantity: 1 },
      { cardId: cardId("41019"), quantity: 3 },
      { cardId: cardId("41020"), quantity: 1 },
      { cardId: cardId("41021"), quantity: 3 },
      { cardId: cardId("41022"), quantity: 1 },
      { cardId: cardId("41023"), quantity: 1 },
      { cardId: cardId("41024"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Psylocke Hero Pack printed decklist card, \"Psylocke Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2023/10/photo-oct-07-2023-4-42-12-pm.jpg, the \"Starter Deck\" link on the Hall of Heroes Psylocke page, https://hallofheroeslcg.com/psylocke-betsy-braddock/), transcribed 2026-10-04",
      ],
      note: "42 cards (identity, obligation and nemesis set excluded): 17 Psylocke, 12 Justice (Lay the Trap is the in-aspect player side scheme), 13 basic. The printed card numbers equal the codes' last digits; every title and quantity matches raw/marvelcdb/psylocke.json quantity/deck_limit. The pack's Aggression, Leadership and Protection extras (41030-41033 other than basic Telekinesis) are not in the precon.",
    },
  },
];
