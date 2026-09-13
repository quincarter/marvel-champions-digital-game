// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/hlk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/hlk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/hlk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack hlk [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const HLK_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("10001a"),
    cardSetCode: "hulk",
    marvelcdbCodes: ["10001a", "10001b"],
    corrections: [
      "data decision: Hulk's printed THW is explicitly 0 (not a dash) — raw thwart=0. Unlike the Core Hulk ally (01050, printed \"—\"), the Hulk hero identity can thwart [evidence: raw; phase7 §1.12].",
    ],
  },
  { cardId: cardId("10002"), cardSetCode: "hulk", marvelcdbCodes: ["10002"], corrections: [] },
  { cardId: cardId("10003"), cardSetCode: "hulk", marvelcdbCodes: ["10003"], corrections: [] },
  { cardId: cardId("10004"), cardSetCode: "hulk", marvelcdbCodes: ["10004"], corrections: [] },
  { cardId: cardId("10005"), cardSetCode: "hulk", marvelcdbCodes: ["10005"], corrections: [] },
  { cardId: cardId("10006"), cardSetCode: "hulk", marvelcdbCodes: ["10006"], corrections: [] },
  { cardId: cardId("10007"), cardSetCode: "hulk", marvelcdbCodes: ["10007"], corrections: [] },
  { cardId: cardId("10008"), cardSetCode: "hulk", marvelcdbCodes: ["10008"], corrections: [] },
  { cardId: cardId("10009"), cardSetCode: "hulk", marvelcdbCodes: ["10009"], corrections: [] },
  { cardId: cardId("10010"), cardSetCode: "hulk", marvelcdbCodes: ["10010"], corrections: [] },
  { cardId: cardId("10011"), cardSetCode: "aggression", marvelcdbCodes: ["10011"], corrections: [] },
  { cardId: cardId("10012"), cardSetCode: "aggression", marvelcdbCodes: ["10012"], corrections: [] },
  { cardId: cardId("10013"), cardSetCode: "aggression", marvelcdbCodes: ["10013"], corrections: [] },
  { cardId: cardId("10014"), cardSetCode: "aggression", marvelcdbCodes: ["10014"], corrections: [] },
  { cardId: cardId("10015"), cardSetCode: "aggression", marvelcdbCodes: ["10015"], corrections: [] },
  { cardId: cardId("10016"), cardSetCode: "aggression", marvelcdbCodes: ["10016"], corrections: [] },
  { cardId: cardId("10017"), cardSetCode: "aggression", marvelcdbCodes: ["10017"], corrections: [] },
  { cardId: cardId("10018"), cardSetCode: "aggression", marvelcdbCodes: ["10018"], corrections: [] },
  { cardId: cardId("10019"), cardSetCode: "basic", marvelcdbCodes: ["10019"], corrections: [] },
  { cardId: cardId("10020"), cardSetCode: "basic", marvelcdbCodes: ["10020"], corrections: [] },
  { cardId: cardId("10021"), cardSetCode: "basic", marvelcdbCodes: ["10021"], corrections: [] },
  { cardId: cardId("10022"), cardSetCode: "basic", marvelcdbCodes: ["10022"], corrections: [] },
  { cardId: cardId("10023"), cardSetCode: "basic", marvelcdbCodes: ["10023"], corrections: [] },
  { cardId: cardId("10024"), cardSetCode: "basic", marvelcdbCodes: ["10024"], corrections: [] },
  { cardId: cardId("10025"), cardSetCode: "hulk", marvelcdbCodes: ["10025"], corrections: [] },
  { cardId: cardId("10026"), cardSetCode: "hulk_nemesis", marvelcdbCodes: ["10026"], corrections: [] },
  { cardId: cardId("10027"), cardSetCode: "hulk_nemesis", marvelcdbCodes: ["10027"], corrections: [] },
  {
    cardId: cardId("10028"),
    cardSetCode: "hulk_nemesis",
    marvelcdbCodes: ["10028"],
    corrections: [
      "10028: MarvelCDB title-cases \"Of The\"; the printed title lowercases both, confirmed on the deck's own printed decklist (\"Clash of the Titans x3\"). [evidence: deck photo (\"28 Clash of the Titans x3\")]",
    ],
  },
  { cardId: cardId("10029"), cardSetCode: "justice", marvelcdbCodes: ["10029"], corrections: [] },
  { cardId: cardId("10030"), cardSetCode: "leadership", marvelcdbCodes: ["10030"], corrections: [] },
  {
    cardId: cardId("10031"),
    cardSetCode: "protection",
    marvelcdbCodes: ["10031"],
    corrections: [
      "10031: MarvelCDB typo (\"Player\" for \"Play\"). Left uncorrected the parser doesn't recognize the restriction sentence at all and it silently becomes ordinary constant ability text instead of an anyPlayerControl play restriction — verified directly against parseCardText. [evidence: raw; phase7 §1.12; every other wave 1 card printing this restriction (msm 05009/05017 area, thor, drs, hlk 10032) reads \"Play under\"]",
    ],
  },
  { cardId: cardId("10032"), cardSetCode: "basic", marvelcdbCodes: ["10032"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const HLK_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
