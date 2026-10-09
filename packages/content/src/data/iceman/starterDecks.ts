// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/iceman (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/iceman.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iceman.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iceman [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const ICEMAN_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("iceman-aggression"),
    name: "Iceman (Aggression) — Iceman Hero Pack starter deck",
    packCode: setCode("iceman"),
    identityCardId: cardId("46001a"),
    aspects: ["aggression"],
    cards: [
      { cardId: cardId("46002"), quantity: 6 },
      { cardId: cardId("46003"), quantity: 2 },
      { cardId: cardId("46004"), quantity: 1 },
      { cardId: cardId("46005"), quantity: 1 },
      { cardId: cardId("46006"), quantity: 1 },
      { cardId: cardId("46007"), quantity: 2 },
      { cardId: cardId("46008"), quantity: 1 },
      { cardId: cardId("46009"), quantity: 2 },
      { cardId: cardId("46010"), quantity: 2 },
      { cardId: cardId("46011"), quantity: 3 },
      { cardId: cardId("46012"), quantity: 1 },
      { cardId: cardId("46013"), quantity: 1 },
      { cardId: cardId("46014"), quantity: 3 },
      { cardId: cardId("46015"), quantity: 3 },
      { cardId: cardId("46016"), quantity: 3 },
      { cardId: cardId("46017"), quantity: 3 },
      { cardId: cardId("46018"), quantity: 1 },
      { cardId: cardId("46019"), quantity: 1 },
      { cardId: cardId("46020"), quantity: 1 },
      { cardId: cardId("46021"), quantity: 3 },
      { cardId: cardId("46022"), quantity: 3 },
      { cardId: cardId("46023"), quantity: 2 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Iceman Hero Pack printed decklist card, \"Iceman Deck\" (the owner's photo of the card, 2026-10-07), transcribed in docs/phase7-wave8-handoff.md",
      ],
      note: "46 entries, 40 counted (identity, obligation and nemesis set excluded): 15 Iceman, 15 Aggression (Keep Up the Pressure is the in-aspect player side scheme), 10 basic, plus Frostbite (46002) x6. Frostbite is Permanent: it is listed in the deck, setup sets the six copies aside, and they do not count toward the 40 (the model of X-23's Claws and Psylocke's Psi-Knives, not Storm's separate Weather Deck). The printed card numbers equal the codes' last digits; every title and quantity matches raw/marvelcdb/iceman.json. The pack's modular set (Sauron, 46029-46032) is not on the decklist card.",
    },
  },
];
