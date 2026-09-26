// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/sm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/sm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/sm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack sm [--offline]

import { cardId, setCode, starterDeckId } from "../../schema/index.js";
import type { StarterDeck } from "../../schema/index.js";

export const SM_STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: starterDeckId("ghost-spider"),
    name: "Ghost-Spider / Protection",
    packCode: setCode("sm"),
    identityCardId: cardId("27001a"),
    aspects: ["protection"],
    cards: [
      { cardId: cardId("27002"), quantity: 3 },
      { cardId: cardId("27003"), quantity: 1 },
      { cardId: cardId("27004"), quantity: 3 },
      { cardId: cardId("27005"), quantity: 2 },
      { cardId: cardId("27006"), quantity: 2 },
      { cardId: cardId("27007"), quantity: 1 },
      { cardId: cardId("27008"), quantity: 1 },
      { cardId: cardId("27009"), quantity: 2 },
      { cardId: cardId("27010"), quantity: 1 },
      { cardId: cardId("27011"), quantity: 1 },
      { cardId: cardId("27012"), quantity: 1 },
      { cardId: cardId("27013"), quantity: 3 },
      { cardId: cardId("27014"), quantity: 3 },
      { cardId: cardId("27015"), quantity: 3 },
      { cardId: cardId("27016"), quantity: 3 },
      { cardId: cardId("27017"), quantity: 1 },
      { cardId: cardId("27018"), quantity: 1 },
      { cardId: cardId("27019"), quantity: 1 },
      { cardId: cardId("27020"), quantity: 1 },
      { cardId: cardId("27021"), quantity: 1 },
      { cardId: cardId("27022"), quantity: 1 },
      { cardId: cardId("27023"), quantity: 1 },
      { cardId: cardId("27024"), quantity: 3 },
    ],
    provenance: {
      verified: true,
      sources: [
        "docs/campaign-modes/markdown/mc27_sinister_motives.md (MC27 p. 20, \"GHOST-SPIDER / PROTECTION\")",
      ],
      note: "40 cards (identity, obligation and nemesis set excluded). MC27 p. 20 lists card titles and quantities, not MarvelCDB codes; each was matched to its raw record by card_set_code (`ghost_spider`/`protection`/`basic`) and name — only one source (the box's own rulebook page) exists for this precon (docs/phase7-wave5-sources.md §5, §7.1: Hall of Heroes' Sinister Motives page embeds the same rulebook image, not an independent transcription).",
    },
  },
  {
    id: starterDeckId("spider-man-morales"),
    name: "Spider-Man (Miles Morales) / Justice",
    packCode: setCode("sm"),
    identityCardId: cardId("27030a"),
    aspects: ["justice"],
    cards: [
      { cardId: cardId("27031"), quantity: 2 },
      { cardId: cardId("27032"), quantity: 2 },
      { cardId: cardId("27033"), quantity: 2 },
      { cardId: cardId("27034"), quantity: 3 },
      { cardId: cardId("27035"), quantity: 1 },
      { cardId: cardId("27036"), quantity: 1 },
      { cardId: cardId("27037"), quantity: 1 },
      { cardId: cardId("27038"), quantity: 1 },
      { cardId: cardId("27039"), quantity: 2 },
      { cardId: cardId("27040"), quantity: 1 },
      { cardId: cardId("27041"), quantity: 1 },
      { cardId: cardId("27042"), quantity: 3 },
      { cardId: cardId("27043"), quantity: 3 },
      { cardId: cardId("27044"), quantity: 3 },
      { cardId: cardId("27045"), quantity: 2 },
      { cardId: cardId("27046"), quantity: 1 },
      { cardId: cardId("27047"), quantity: 1 },
      { cardId: cardId("27048"), quantity: 1 },
      { cardId: cardId("27049"), quantity: 1 },
      { cardId: cardId("27050"), quantity: 1 },
      { cardId: cardId("27051"), quantity: 1 },
      { cardId: cardId("27052"), quantity: 1 },
      { cardId: cardId("27053"), quantity: 1 },
      { cardId: cardId("27054"), quantity: 3 },
      { cardId: cardId("27055"), quantity: 1 },
    ],
    provenance: {
      verified: true,
      sources: ["docs/campaign-modes/markdown/mc27_sinister_motives.md (MC27 p. 20, \"SPIDER-MAN / JUSTICE\")"],
      note: "40 cards (identity, obligation and nemesis set excluded); same single-source caveat as Ghost-Spider's.",
    },
  },
];
