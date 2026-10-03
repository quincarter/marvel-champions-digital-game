// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/cyclops (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/cyclops.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/cyclops.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack cyclops [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const CYCLOPS_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("33001a"),
    cardSetCode: "cyclops",
    marvelcdbCodes: ["33001a", "33001b"],
    corrections: [],
  },
  { cardId: cardId("33002"), cardSetCode: "cyclops", marvelcdbCodes: ["33002"], corrections: [] },
  { cardId: cardId("33003"), cardSetCode: "cyclops", marvelcdbCodes: ["33003"], corrections: [] },
  { cardId: cardId("33004"), cardSetCode: "cyclops", marvelcdbCodes: ["33004"], corrections: [] },
  { cardId: cardId("33005"), cardSetCode: "cyclops", marvelcdbCodes: ["33005"], corrections: [] },
  { cardId: cardId("33006"), cardSetCode: "cyclops", marvelcdbCodes: ["33006"], corrections: [] },
  { cardId: cardId("33007"), cardSetCode: "cyclops", marvelcdbCodes: ["33007"], corrections: [] },
  { cardId: cardId("33008"), cardSetCode: "cyclops", marvelcdbCodes: ["33008"], corrections: [] },
  { cardId: cardId("33009"), cardSetCode: "cyclops", marvelcdbCodes: ["33009"], corrections: [] },
  { cardId: cardId("33010"), cardSetCode: "cyclops", marvelcdbCodes: ["33010"], corrections: [] },
  { cardId: cardId("33011"), cardSetCode: "leadership", marvelcdbCodes: ["33011"], corrections: [] },
  { cardId: cardId("33012"), cardSetCode: "aggression", marvelcdbCodes: ["33012"], corrections: [] },
  { cardId: cardId("33013"), cardSetCode: "protection", marvelcdbCodes: ["33013"], corrections: [] },
  { cardId: cardId("33014"), cardSetCode: "justice", marvelcdbCodes: ["33014"], corrections: [] },
  { cardId: cardId("33015"), cardSetCode: "leadership", marvelcdbCodes: ["33015"], corrections: [] },
  { cardId: cardId("33016"), cardSetCode: "leadership", marvelcdbCodes: ["33016"], corrections: [] },
  {
    cardId: cardId("33017"),
    cardSetCode: "leadership",
    marvelcdbCodes: ["33017"],
    corrections: [],
    duplicateOfCardId: cardId("06032"),
  },
  { cardId: cardId("33018"), cardSetCode: "leadership", marvelcdbCodes: ["33018"], corrections: [] },
  { cardId: cardId("33019"), cardSetCode: "basic", marvelcdbCodes: ["33019"], corrections: [] },
  { cardId: cardId("33020"), cardSetCode: "basic", marvelcdbCodes: ["33020"], corrections: [] },
  { cardId: cardId("33021"), cardSetCode: "basic", marvelcdbCodes: ["33021"], corrections: [] },
  { cardId: cardId("33022"), cardSetCode: "basic", marvelcdbCodes: ["33022"], corrections: [] },
  { cardId: cardId("33023"), cardSetCode: "basic", marvelcdbCodes: ["33023"], corrections: [] },
  {
    cardId: cardId("33024"),
    cardSetCode: "basic",
    marvelcdbCodes: ["33024"],
    corrections: [],
    duplicateOfCardId: cardId("01088"),
  },
  {
    cardId: cardId("33025"),
    cardSetCode: "basic",
    marvelcdbCodes: ["33025"],
    corrections: [],
    duplicateOfCardId: cardId("01089"),
  },
  {
    cardId: cardId("33026"),
    cardSetCode: "basic",
    marvelcdbCodes: ["33026"],
    corrections: [],
    duplicateOfCardId: cardId("01090"),
  },
  {
    cardId: cardId("33027"),
    cardSetCode: "cyclops",
    marvelcdbCodes: ["33027"],
    corrections: [
      "33027: Lost Visor prints \"Search your hand, deck, discard pile, and play area for Ruby Quartz Visor and place it facedown under this card.\" with no When Revealed header, so the parser emitted only -constant and -action refs and nothing ran the search on reveal. The sentence is split into its own 33027.lost-visor-when-revealed ref; the card text is unchanged. [evidence: Card scan assets/card-art/bundles/cards/33027.png: \"Give to the Scott Summers player.\" / \"Search your hand, deck, discard pile, and play area for Ruby Quartz Visor and place it facedown under this card.\" / \"Cyclops cannot attack.\" / \"Alter-Ego Action: Exhaust Scott Summers → add Ruby Quartz Visor to your hand and remove Lost Visor from the game.\"]",
    ],
  },
  {
    cardId: cardId("33028"),
    cardSetCode: "cyclops_nemesis",
    marvelcdbCodes: ["33028"],
    corrections: [],
  },
  {
    cardId: cardId("33029"),
    cardSetCode: "cyclops_nemesis",
    marvelcdbCodes: ["33029"],
    corrections: [],
  },
  {
    cardId: cardId("33030"),
    cardSetCode: "cyclops_nemesis",
    marvelcdbCodes: ["33030"],
    corrections: [],
  },
  {
    cardId: cardId("33031"),
    cardSetCode: "cyclops_nemesis",
    marvelcdbCodes: ["33031"],
    corrections: [],
  },
  { cardId: cardId("33032"), cardSetCode: "aggression", marvelcdbCodes: ["33032"], corrections: [] },
  { cardId: cardId("33033"), cardSetCode: "justice", marvelcdbCodes: ["33033"], corrections: [] },
  { cardId: cardId("33034"), cardSetCode: "protection", marvelcdbCodes: ["33034"], corrections: [] },
  { cardId: cardId("33035"), cardSetCode: "basic", marvelcdbCodes: ["33035"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const CYCLOPS_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
