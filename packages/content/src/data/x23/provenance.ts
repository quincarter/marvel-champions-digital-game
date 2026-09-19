// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/x23 (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/x23.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/x23.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack x23 [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const X23_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("43001a"),
    cardSetCode: "x23",
    marvelcdbCodes: ["43001a", "43001b"],
    corrections: [],
  },
  {
    cardId: cardId("43002"),
    cardSetCode: "x23",
    marvelcdbCodes: ["43002"],
    corrections: [
      "43002: X-23's Claws is a Permanent signature weapon, exhausted for its own Hero Action rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap. [evidence: MarvelCDB card listing (marvelcdb.com/card/43002), \"Cost: —\"]",
    ],
  },
  { cardId: cardId("43003"), cardSetCode: "x23", marvelcdbCodes: ["43003"], corrections: [] },
  { cardId: cardId("43004"), cardSetCode: "x23", marvelcdbCodes: ["43004"], corrections: [] },
  { cardId: cardId("43005"), cardSetCode: "x23", marvelcdbCodes: ["43005"], corrections: [] },
  { cardId: cardId("43006"), cardSetCode: "x23", marvelcdbCodes: ["43006"], corrections: [] },
  { cardId: cardId("43007"), cardSetCode: "x23", marvelcdbCodes: ["43007"], corrections: [] },
  { cardId: cardId("43008"), cardSetCode: "x23", marvelcdbCodes: ["43008"], corrections: [] },
  { cardId: cardId("43009"), cardSetCode: "x23", marvelcdbCodes: ["43009"], corrections: [] },
  { cardId: cardId("43010"), cardSetCode: "x23", marvelcdbCodes: ["43010"], corrections: [] },
  { cardId: cardId("43011"), cardSetCode: "x23", marvelcdbCodes: ["43011"], corrections: [] },
  {
    cardId: cardId("43012"),
    cardSetCode: "x23",
    marvelcdbCodes: ["43012"],
    corrections: [
      "data decision: attackedThisTurnBy is data only (docs/phase7-wave2.md §7.4) — the engine has no per-turn attack history yet, so this card resolves to no legal host and must not be marked playable until that primitive lands.",
    ],
  },
  { cardId: cardId("43013"), cardSetCode: "aggression", marvelcdbCodes: ["43013"], corrections: [] },
  { cardId: cardId("43014"), cardSetCode: "aggression", marvelcdbCodes: ["43014"], corrections: [] },
  { cardId: cardId("43015"), cardSetCode: "aggression", marvelcdbCodes: ["43015"], corrections: [] },
  { cardId: cardId("43016"), cardSetCode: "aggression", marvelcdbCodes: ["43016"], corrections: [] },
  {
    cardId: cardId("43017"),
    cardSetCode: "aggression",
    marvelcdbCodes: ["43017"],
    corrections: [],
    duplicateOfCardId: cardId("12030"),
  },
  { cardId: cardId("43018"), cardSetCode: "aggression", marvelcdbCodes: ["43018"], corrections: [] },
  { cardId: cardId("43019"), cardSetCode: "aggression", marvelcdbCodes: ["43019"], corrections: [] },
  { cardId: cardId("43020"), cardSetCode: "aggression", marvelcdbCodes: ["43020"], corrections: [] },
  { cardId: cardId("43021"), cardSetCode: "basic", marvelcdbCodes: ["43021"], corrections: [] },
  {
    cardId: cardId("43022"),
    cardSetCode: "basic",
    marvelcdbCodes: ["43022"],
    corrections: [],
    duplicateOfCardId: cardId("01088"),
  },
  {
    cardId: cardId("43023"),
    cardSetCode: "basic",
    marvelcdbCodes: ["43023"],
    corrections: [],
    duplicateOfCardId: cardId("01089"),
  },
  {
    cardId: cardId("43024"),
    cardSetCode: "basic",
    marvelcdbCodes: ["43024"],
    corrections: [],
    duplicateOfCardId: cardId("01090"),
  },
  {
    cardId: cardId("43025"),
    cardSetCode: "basic",
    marvelcdbCodes: ["43025"],
    corrections: [],
    duplicateOfCardId: cardId("41022"),
  },
  {
    cardId: cardId("43026"),
    cardSetCode: "basic",
    marvelcdbCodes: ["43026"],
    corrections: [],
    duplicateOfCardId: cardId("41023"),
  },
  {
    cardId: cardId("43027"),
    cardSetCode: "basic",
    marvelcdbCodes: ["43027"],
    corrections: [],
    duplicateOfCardId: cardId("36026"),
  },
  { cardId: cardId("43028"), cardSetCode: "x23", marvelcdbCodes: ["43028"], corrections: [] },
  { cardId: cardId("43029"), cardSetCode: "x23_nemesis", marvelcdbCodes: ["43029"], corrections: [] },
  { cardId: cardId("43030"), cardSetCode: "x23_nemesis", marvelcdbCodes: ["43030"], corrections: [] },
  { cardId: cardId("43031"), cardSetCode: "x23_nemesis", marvelcdbCodes: ["43031"], corrections: [] },
  { cardId: cardId("43032"), cardSetCode: "x23_nemesis", marvelcdbCodes: ["43032"], corrections: [] },
  { cardId: cardId("43033"), cardSetCode: "x23_nemesis", marvelcdbCodes: ["43033"], corrections: [] },
  { cardId: cardId("43034"), cardSetCode: "basic", marvelcdbCodes: ["43034"], corrections: [] },
  { cardId: cardId("43035"), cardSetCode: "basic", marvelcdbCodes: ["43035"], corrections: [] },
  { cardId: cardId("43036"), cardSetCode: "basic", marvelcdbCodes: ["43036"], corrections: [] },
  { cardId: cardId("43037"), cardSetCode: "basic", marvelcdbCodes: ["43037"], corrections: [] },
  { cardId: cardId("43038"), cardSetCode: "justice", marvelcdbCodes: ["43038"], corrections: [] },
  { cardId: cardId("43039"), cardSetCode: "leadership", marvelcdbCodes: ["43039"], corrections: [] },
  { cardId: cardId("43040"), cardSetCode: "protection", marvelcdbCodes: ["43040"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const X23_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
