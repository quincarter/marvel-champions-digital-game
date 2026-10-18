// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/fne (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/fne.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/fne.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack fne [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const FNE_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("fne-daredevil-justice"),
    name: "Daredevil (Justice) — Fear No Evil starter deck",
    packCode: setCode("fne"),
    identityCardId: cardId("60001a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("60007"), quantity: 1 },
      { cardId: cardId("60008"), quantity: 2 },
      { cardId: cardId("60009"), quantity: 2 },
      { cardId: cardId("60010"), quantity: 2 },
      { cardId: cardId("60011"), quantity: 1 },
      { cardId: cardId("60012"), quantity: 1 },
      { cardId: cardId("60013"), quantity: 1 },
      { cardId: cardId("60014"), quantity: 1 },
      { cardId: cardId("60015"), quantity: 1 },
      { cardId: cardId("60016"), quantity: 1 },
      { cardId: cardId("60017"), quantity: 1 },
      { cardId: cardId("60018"), quantity: 1 },
      { cardId: cardId("60019"), quantity: 1 },
      { cardId: cardId("60020"), quantity: 1 },
      { cardId: cardId("60021"), quantity: 1 },
      { cardId: cardId("60022"), quantity: 1 },
      { cardId: cardId("60023"), quantity: 3 },
      { cardId: cardId("60024"), quantity: 1 },
      { cardId: cardId("60025"), quantity: 3 },
      { cardId: cardId("60026"), quantity: 3 },
      { cardId: cardId("60027"), quantity: 3 },
      { cardId: cardId("60028"), quantity: 3 },
      { cardId: cardId("60029"), quantity: 1 },
      { cardId: cardId("60030"), quantity: 3 },
      { cardId: cardId("60031"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "MC60 rulebook p. 25 \"Starter Decks\" (docs/campaign-modes/markdown/mc60_fear_no_evil.md, read 2026-10-18); every copy count is within the record's quantity, read against the raw cache.",
      ],
      note: "40 cards. Sense cards 60002 to 60006 are the identity's separate deck, outside the 40 (the page lists them first). Nemesis set: Bullseye, Deadliest Man Alive, Stolen Sai, Eye on the Target (x2).",
    },
  },
  {
    id: starterDeckId("fne-echo-protection"),
    name: "Echo (Protection) — Fear No Evil starter deck",
    packCode: setCode("fne"),
    identityCardId: cardId("60037a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("60038"), quantity: 1 },
      { cardId: cardId("60039"), quantity: 1 },
      { cardId: cardId("60040a"), quantity: 2 },
      { cardId: cardId("60040b"), quantity: 2 },
      { cardId: cardId("60040c"), quantity: 2 },
      { cardId: cardId("60041"), quantity: 2 },
      { cardId: cardId("60042"), quantity: 1 },
      { cardId: cardId("60043"), quantity: 1 },
      { cardId: cardId("60044"), quantity: 1 },
      { cardId: cardId("60045"), quantity: 1 },
      { cardId: cardId("60046"), quantity: 1 },
      { cardId: cardId("60047"), quantity: 1 },
      { cardId: cardId("60048"), quantity: 3 },
      { cardId: cardId("60049"), quantity: 3 },
      { cardId: cardId("60050"), quantity: 3 },
      { cardId: cardId("60051"), quantity: 3 },
      { cardId: cardId("60052"), quantity: 3 },
      { cardId: cardId("60053"), quantity: 1 },
      { cardId: cardId("60054"), quantity: 3 },
      { cardId: cardId("60055"), quantity: 1 },
      { cardId: cardId("60056"), quantity: 1 },
      { cardId: cardId("60057"), quantity: 1 },
      { cardId: cardId("60058"), quantity: 1 },
      { cardId: cardId("60059"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: [
        "MC60 rulebook p. 25 \"Starter Decks\" (docs/campaign-modes/markdown/mc60_fear_no_evil.md, read 2026-10-18); every copy count is within the record's quantity, read against the raw cache.",
        "Basic line: See No Evil, Hear No Evil; Superpower Training; Energy; Genius; Strength. MarvelCDB decklist 63934 (\"Echo - precon deck\", posted 2026-07-24) swaps Strength for Stick (60029); the rulebook is the primary source, so its list is used.",
      ],
      note: "Innate Reflexes (60038) has the Starting keyword (MC60 p. 3). Photographic Reflexes is six copies in three printings of two (the page's \"(x6)\").",
    },
  },
];
