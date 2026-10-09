// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/aos (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/aos.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/aos.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack aos [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const AOS_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("maria-hill-leadership"),
    name: "Maria Hill / Leadership",
    packCode: setCode("aos"),
    identityCardId: cardId("50001a"),
    aspects: ["leadership"],
    cards: [
      { cardId: cardId("50002"), quantity: 1 },
      { cardId: cardId("50003"), quantity: 2 },
      { cardId: cardId("50004"), quantity: 2 },
      { cardId: cardId("50005"), quantity: 3 },
      { cardId: cardId("50006"), quantity: 1 },
      { cardId: cardId("50007"), quantity: 2 },
      { cardId: cardId("50008"), quantity: 1 },
      { cardId: cardId("50009"), quantity: 1 },
      { cardId: cardId("50010"), quantity: 1 },
      { cardId: cardId("50011"), quantity: 1 },
      { cardId: cardId("50012"), quantity: 1 },
      { cardId: cardId("50013"), quantity: 1 },
      { cardId: cardId("50014"), quantity: 3 },
      { cardId: cardId("50015"), quantity: 3 },
      { cardId: cardId("50016"), quantity: 3 },
      { cardId: cardId("50017"), quantity: 1 },
      { cardId: cardId("50018"), quantity: 1 },
      { cardId: cardId("50019"), quantity: 1 },
      { cardId: cardId("50020"), quantity: 1 },
      { cardId: cardId("50021"), quantity: 1 },
      { cardId: cardId("50022"), quantity: 1 },
      { cardId: cardId("50023"), quantity: 1 },
      { cardId: cardId("50024"), quantity: 1 },
      { cardId: cardId("50025"), quantity: 1 },
      { cardId: cardId("50026"), quantity: 1 },
      { cardId: cardId("50027"), quantity: 1 },
      { cardId: cardId("50028"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "MC50 rulebook p. 7 (docs/campaign-modes/markdown/mc50_agents_of_shield.md, MARIA HILL / LEADERSHIP); the printed page was rendered and read against the list by the main session on 2026-10-09 (docs/phase7-wave9-data-survey.md section 6.1)",
      ],
      note: "40 cards (identity, obligation and nemesis set excluded): 15 Maria Hill, 15 Leadership (12 Leadership plus The Bellerophon, The Douglass and The Pericles, one each in Aggression, Justice and Protection), 10 basic. The page lists titles and quantities, not codes; each was matched by name to raw/marvelcdb/aos.json. Super Spies 50024 has quantity 2 in the box; the deck uses 1 (deck limit 1).",
    },
  },
  {
    id: starterDeckId("nick-fury-justice"),
    name: "Nick Fury / Justice",
    packCode: setCode("aos"),
    identityCardId: cardId("50034a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("50024"), quantity: 1 },
      { cardId: cardId("50035a"), quantity: 1 },
      { cardId: cardId("50036"), quantity: 1 },
      { cardId: cardId("50037"), quantity: 2 },
      { cardId: cardId("50038"), quantity: 3 },
      { cardId: cardId("50039"), quantity: 2 },
      { cardId: cardId("50040"), quantity: 1 },
      { cardId: cardId("50041"), quantity: 1 },
      { cardId: cardId("50042"), quantity: 1 },
      { cardId: cardId("50043"), quantity: 1 },
      { cardId: cardId("50044"), quantity: 1 },
      { cardId: cardId("50045"), quantity: 1 },
      { cardId: cardId("50046"), quantity: 1 },
      { cardId: cardId("50047"), quantity: 1 },
      { cardId: cardId("50048"), quantity: 1 },
      { cardId: cardId("50049"), quantity: 3 },
      { cardId: cardId("50050"), quantity: 3 },
      { cardId: cardId("50051"), quantity: 3 },
      { cardId: cardId("50052"), quantity: 3 },
      { cardId: cardId("50053"), quantity: 3 },
      { cardId: cardId("50054"), quantity: 1 },
      { cardId: cardId("50055"), quantity: 1 },
      { cardId: cardId("50056"), quantity: 1 },
      { cardId: cardId("50057"), quantity: 1 },
      { cardId: cardId("50058"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "MC50 rulebook p. 7 (docs/campaign-modes/markdown/mc50_agents_of_shield.md, NICK FURY / JUSTICE); the printed page was rendered and read against the list by the main session on 2026-10-09 (docs/phase7-wave9-data-survey.md section 6.1)",
      ],
      note: "41 entries, 40 counted (identity, obligation and nemesis set excluded): 16 Nick Fury (including Assault / Stealth 50035a), 17 Justice, 8 basic. Assault / Stealth is his Permanent suit form upgrade: it starts in play and does not count toward the 40, listed in `cards` the way X-23's Claws (`x23` 43002, 41 entries) and Iceman's Frostbite (`iceman` 46002) are, because the normalizer requires every hero-kit card at its kit quantity. Page lists titles and quantities, not codes; matched by name to raw/marvelcdb/aos.json.",
    },
  },
];
