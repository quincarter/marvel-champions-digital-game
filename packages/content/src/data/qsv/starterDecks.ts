// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/qsv (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/qsv.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/qsv.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack qsv [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const QSV_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("qsv-protection"),
    name: "Quicksilver (Protection) — Hero Pack starter deck",
    packCode: setCode("qsv"),
    identityCardId: cardId("14001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("14002"), quantity: 1 },
      { cardId: cardId("14003"), quantity: 4 },
      { cardId: cardId("14004"), quantity: 2 },
      { cardId: cardId("14005"), quantity: 2 },
      { cardId: cardId("14006"), quantity: 1 },
      { cardId: cardId("14007"), quantity: 1 },
      { cardId: cardId("14008"), quantity: 1 },
      { cardId: cardId("14009"), quantity: 1 },
      { cardId: cardId("14010"), quantity: 1 },
      { cardId: cardId("14011"), quantity: 1 },
      { cardId: cardId("14012"), quantity: 3 },
      { cardId: cardId("14013"), quantity: 1 },
      { cardId: cardId("14014"), quantity: 3 },
      { cardId: cardId("14015"), quantity: 3 },
      { cardId: cardId("14016"), quantity: 2 },
      { cardId: cardId("14017"), quantity: 3 },
      { cardId: cardId("14018"), quantity: 1 },
      { cardId: cardId("14019"), quantity: 1 },
      { cardId: cardId("14020"), quantity: 1 },
      { cardId: cardId("14021"), quantity: 1 },
      { cardId: cardId("14022"), quantity: 3 },
      { cardId: cardId("14023"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Hall of Heroes Quicksilver Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/12/qs.jpg, linked from https://hallofheroeslcg.com/quicksilver/)",
      ],
      note: "Cross-checked item-by-item against raw (qsv.json) by name, code and quantity: item 2 \"Scarlet Witch\" is 14002 (qty 1, the Team-Up ally printed in this hero kit, faction_code \"hero\"), and every Basic/Protection/nemesis item matches its listed code and quantity exactly (e.g. \"28 Earthquake x2\" = 14028, quantity 2 in raw).",
    },
  },
];
