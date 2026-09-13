// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/drs (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/drs.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/drs.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack drs [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const DRS_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("drs-protection"),
    name: "Doctor Strange (Protection) — Hero Pack starter deck",
    packCode: setCode("drs"),
    identityCardId: cardId("09001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("09002"), quantity: 1 },
      { cardId: cardId("09003"), quantity: 2 },
      { cardId: cardId("09004"), quantity: 2 },
      { cardId: cardId("09005"), quantity: 2 },
      { cardId: cardId("09006"), quantity: 1 },
      { cardId: cardId("09007"), quantity: 2 },
      { cardId: cardId("09008"), quantity: 1 },
      { cardId: cardId("09009"), quantity: 1 },
      { cardId: cardId("09010"), quantity: 2 },
      { cardId: cardId("09011"), quantity: 1 },
      { cardId: cardId("09012"), quantity: 1 },
      { cardId: cardId("09013"), quantity: 1 },
      { cardId: cardId("09014"), quantity: 1 },
      { cardId: cardId("09015"), quantity: 3 },
      { cardId: cardId("09016"), quantity: 3 },
      { cardId: cardId("09017"), quantity: 2 },
      { cardId: cardId("09018"), quantity: 2 },
      { cardId: cardId("09019"), quantity: 1 },
      { cardId: cardId("09020"), quantity: 3 },
      { cardId: cardId("09021"), quantity: 3 },
      { cardId: cardId("09022"), quantity: 1 },
      { cardId: cardId("09023"), quantity: 1 },
      { cardId: cardId("09024"), quantity: 1 },
      { cardId: cardId("09025"), quantity: 1 },
      { cardId: cardId("09026"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "Doctor Strange Deck title-card back, printed decklist (https://hallofheroeslcg.com/wp-content/uploads/2020/06/doctorstrangestarterdeck.jpg, linked from https://hallofheroeslcg.com/stephen-strange-doctor-strange/)",
      ],
      note: "The Invocation deck (Crimson Bands of Cyttorak, Images of Ikonn, Seven Rings of Raggadorr, Vapors of Valtorr, Winds of Watoomb, 09032-09036) is printed on the deck photo under its own \"Invocation Deck\" heading, separate from the 40-card player deck list above — per docs/phase7-wave1.md §1.9 it is not listed in `cards` at all; it comes from the identity's `separateDecks`.",
    },
  },
];
