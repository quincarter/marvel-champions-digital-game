// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/angel (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/angel.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/angel.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack angel [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const ANGEL_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("angel-protection"),
    name: "Angel (Protection) — Angel Hero Pack starter deck",
    packCode: setCode("angel"),
    identityCardId: cardId("42001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("42002"), quantity: 1 },
      { cardId: cardId("42003"), quantity: 2 },
      { cardId: cardId("42004"), quantity: 2 },
      { cardId: cardId("42005"), quantity: 2 },
      { cardId: cardId("42006"), quantity: 2 },
      { cardId: cardId("42007"), quantity: 2 },
      { cardId: cardId("42008"), quantity: 2 },
      { cardId: cardId("42009"), quantity: 1 },
      { cardId: cardId("42010"), quantity: 1 },
      { cardId: cardId("42011"), quantity: 1 },
      { cardId: cardId("42012"), quantity: 1 },
      { cardId: cardId("42013"), quantity: 1 },
      { cardId: cardId("42014"), quantity: 3 },
      { cardId: cardId("42015"), quantity: 3 },
      { cardId: cardId("42016"), quantity: 3 },
      { cardId: cardId("42017"), quantity: 1 },
      { cardId: cardId("42018"), quantity: 1 },
      { cardId: cardId("42019"), quantity: 3 },
      { cardId: cardId("42020"), quantity: 1 },
      { cardId: cardId("42021"), quantity: 1 },
      { cardId: cardId("42022"), quantity: 3 },
      { cardId: cardId("42023"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Angel Hero Pack printed decklist card, \"Angel Deck\" (https://hallofheroeslcg.com/wp-content/uploads/2023/10/photo-oct-07-2023-4-42-19-pm.jpg, the \"Starter Deck\" link on the Hall of Heroes Angel page, https://hallofheroeslcg.com/angel-warren-worthington-iii/), transcribed 2026-10-04",
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Angel, 17 Protection (Render Medical Aid is the in-aspect player side scheme), 8 basic. Identity is the three-face 42001 (a/b/c) keyed on 42001a as ant/wsp do. The printed card numbers equal the codes' last digits; every quantity matches raw/marvelcdb/angel.json. Title disagreement: the decklist card's entry 17 reads \"Triage\" while MarvelCDB (and the normalized data) title 42017 \"Render Medical Aid\"; same number, same Protection player side scheme.",
    },
  },
];
