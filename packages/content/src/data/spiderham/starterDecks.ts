// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/spiderham (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/spiderham.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/spiderham.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack spiderham [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const SPIDERHAM_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("spiderham-justice"),
    name: "Spider-Ham (Justice) — Spider-Ham Hero Pack starter deck",
    packCode: setCode("spiderham"),
    identityCardId: cardId("30001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("30002"), quantity: 1 },
      { cardId: cardId("30003"), quantity: 2 },
      { cardId: cardId("30004"), quantity: 1 },
      { cardId: cardId("30005"), quantity: 1 },
      { cardId: cardId("30006"), quantity: 2 },
      { cardId: cardId("30007"), quantity: 3 },
      { cardId: cardId("30008"), quantity: 1 },
      { cardId: cardId("30009"), quantity: 2 },
      { cardId: cardId("30010"), quantity: 1 },
      { cardId: cardId("30011"), quantity: 1 },
      { cardId: cardId("30012"), quantity: 1 },
      { cardId: cardId("30013"), quantity: 1 },
      { cardId: cardId("30014"), quantity: 3 },
      { cardId: cardId("30015"), quantity: 2 },
      { cardId: cardId("30016"), quantity: 3 },
      { cardId: cardId("30017"), quantity: 3 },
      { cardId: cardId("30018"), quantity: 3 },
      { cardId: cardId("30019"), quantity: 3 },
      { cardId: cardId("30020"), quantity: 1 },
      { cardId: cardId("30021"), quantity: 1 },
      { cardId: cardId("30022"), quantity: 3 },
      { cardId: cardId("30023"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Spider-Ham Hero Pack printed decklist card, \"Spider-Ham Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2022/07/sd.jpg, linked from the Hall of Heroes Spider-Ham page, https://hallofheroeslcg.com/spider-ham-peter-porker/), transcribed 2026-09-26",
      ],
      note: "No second (MarvelCDB community decklist or rulebook) source found for this pack's precon as of this pass — single-sourced from the pack's own printed decklist card.",
    },
  },
];
