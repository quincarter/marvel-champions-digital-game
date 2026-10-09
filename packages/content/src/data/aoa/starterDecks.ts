// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/aoa (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/aoa.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/aoa.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack aoa [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const AOA_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("bishop-leadership"),
    name: "Bishop / Leadership",
    packCode: setCode("aoa"),
    identityCardId: cardId("45001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("45002"), quantity: 1 },
      { cardId: cardId("45003"), quantity: 1 },
      { cardId: cardId("45004"), quantity: 1 },
      { cardId: cardId("45005"), quantity: 1 },
      { cardId: cardId("45006"), quantity: 2 },
      { cardId: cardId("45007"), quantity: 2 },
      { cardId: cardId("45008"), quantity: 2 },
      { cardId: cardId("45009"), quantity: 2 },
      { cardId: cardId("45010"), quantity: 3 },
      { cardId: cardId("45011"), quantity: 1 },
      { cardId: cardId("45012"), quantity: 1 },
      { cardId: cardId("45013"), quantity: 3 },
      { cardId: cardId("45014"), quantity: 3 },
      { cardId: cardId("45015"), quantity: 1 },
      { cardId: cardId("45016"), quantity: 3 },
      { cardId: cardId("45017"), quantity: 3 },
      { cardId: cardId("45018"), quantity: 3 },
      { cardId: cardId("45019"), quantity: 2 },
      { cardId: cardId("45020"), quantity: 1 },
      { cardId: cardId("45021"), quantity: 1 },
      { cardId: cardId("45022"), quantity: 1 },
      { cardId: cardId("45023"), quantity: 1 },
      { cardId: cardId("45024"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: ["MC45 p. 22 (docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf, \"BISHOP / LEADERSHIP\")"],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Bishop, 20 Leadership, 5 basic. MC45 p. 22 lists titles and quantities, not codes; each was matched to raw/marvelcdb/aoa.json by name and card_set_code (bishop/basic) or faction_code, and every quantity equals the raw printed quantity.",
    },
  },
  {
    id: starterDeckId("magik-aggression"),
    name: "Magik / Aggression",
    packCode: setCode("aoa"),
    identityCardId: cardId("45030a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("45031"), quantity: 1 },
      { cardId: cardId("45032"), quantity: 1 },
      { cardId: cardId("45033"), quantity: 1 },
      { cardId: cardId("45034"), quantity: 1 },
      { cardId: cardId("45035"), quantity: 1 },
      { cardId: cardId("45036"), quantity: 1 },
      { cardId: cardId("45037"), quantity: 3 },
      { cardId: cardId("45038"), quantity: 2 },
      { cardId: cardId("45039"), quantity: 2 },
      { cardId: cardId("45040"), quantity: 2 },
      { cardId: cardId("45041"), quantity: 1 },
      { cardId: cardId("45042"), quantity: 1 },
      { cardId: cardId("45043"), quantity: 3 },
      { cardId: cardId("45044"), quantity: 3 },
      { cardId: cardId("45045"), quantity: 3 },
      { cardId: cardId("45046"), quantity: 3 },
      { cardId: cardId("45047"), quantity: 2 },
      { cardId: cardId("45048"), quantity: 1 },
      { cardId: cardId("45049"), quantity: 1 },
      { cardId: cardId("45050"), quantity: 1 },
      { cardId: cardId("45051"), quantity: 3 },
      { cardId: cardId("45052"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: ["MC45 p. 22 (docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf, \"MAGIK / AGGRESSION\")"],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Magik, 16 Aggression, 9 basic. MC45 p. 22 lists titles and quantities, not codes; each was matched to raw/marvelcdb/aoa.json by name and card_set_code (magik/basic) or faction_code, and every quantity equals the raw printed quantity.",
    },
  },
];
