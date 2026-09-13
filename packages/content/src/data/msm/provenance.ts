// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/msm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/msm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/msm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack msm [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const MSM_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("05001a"),
    cardSetCode: "ms_marvel",
    marvelcdbCodes: ["05001a", "05001b"],
    corrections: [],
  },
  { cardId: cardId("05002"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05002"], corrections: [] },
  { cardId: cardId("05003"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05003"], corrections: [] },
  { cardId: cardId("05004"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05004"], corrections: [] },
  { cardId: cardId("05005"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05005"], corrections: [] },
  { cardId: cardId("05006"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05006"], corrections: [] },
  { cardId: cardId("05007"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05007"], corrections: [] },
  { cardId: cardId("05008"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05008"], corrections: [] },
  { cardId: cardId("05009"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05009"], corrections: [] },
  { cardId: cardId("05010"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05010"], corrections: [] },
  { cardId: cardId("05011"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05011"], corrections: [] },
  { cardId: cardId("05012"), cardSetCode: "protection", marvelcdbCodes: ["05012"], corrections: [] },
  { cardId: cardId("05013"), cardSetCode: "protection", marvelcdbCodes: ["05013"], corrections: [] },
  {
    cardId: cardId("05014"),
    cardSetCode: "protection",
    marvelcdbCodes: ["05014"],
    corrections: [
      "data decision: Preemptive Strike carries raw attack=3/thwart=1 in MarvelCDB's data, but it is an event — printed events carry no ATK/THW stat box, and the schema's EventCard type has no such fields, so these two raw fields are simply not read. Its actual ability (\"cancel all boost icons... deal 1 damage to the villain for each boost icon cancelled\") has nothing to do with those numbers [evidence: raw; phase7 §1.12].",
    ],
  },
  { cardId: cardId("05015"), cardSetCode: "protection", marvelcdbCodes: ["05015"], corrections: [] },
  { cardId: cardId("05016"), cardSetCode: "protection", marvelcdbCodes: ["05016"], corrections: [] },
  { cardId: cardId("05017"), cardSetCode: "protection", marvelcdbCodes: ["05017"], corrections: [] },
  { cardId: cardId("05018"), cardSetCode: "basic", marvelcdbCodes: ["05018"], corrections: [] },
  { cardId: cardId("05019"), cardSetCode: "basic", marvelcdbCodes: ["05019"], corrections: [] },
  { cardId: cardId("05020"), cardSetCode: "basic", marvelcdbCodes: ["05020"], corrections: [] },
  { cardId: cardId("05021"), cardSetCode: "basic", marvelcdbCodes: ["05021"], corrections: [] },
  { cardId: cardId("05022"), cardSetCode: "basic", marvelcdbCodes: ["05022"], corrections: [] },
  { cardId: cardId("05023"), cardSetCode: "basic", marvelcdbCodes: ["05023"], corrections: [] },
  { cardId: cardId("05024"), cardSetCode: "basic", marvelcdbCodes: ["05024"], corrections: [] },
  { cardId: cardId("05025"), cardSetCode: "ms_marvel", marvelcdbCodes: ["05025"], corrections: [] },
  {
    cardId: cardId("05026"),
    cardSetCode: "ms_marvel_nemesis",
    marvelcdbCodes: ["05026"],
    corrections: [],
  },
  {
    cardId: cardId("05027"),
    cardSetCode: "ms_marvel_nemesis",
    marvelcdbCodes: ["05027"],
    corrections: [],
  },
  {
    cardId: cardId("05028"),
    cardSetCode: "ms_marvel_nemesis",
    marvelcdbCodes: ["05028"],
    corrections: [],
  },
  {
    cardId: cardId("05029"),
    cardSetCode: "ms_marvel_nemesis",
    marvelcdbCodes: ["05029"],
    corrections: [],
  },
  { cardId: cardId("05030"), cardSetCode: "aggression", marvelcdbCodes: ["05030"], corrections: [] },
  { cardId: cardId("05031"), cardSetCode: "justice", marvelcdbCodes: ["05031"], corrections: [] },
  { cardId: cardId("05032"), cardSetCode: "leadership", marvelcdbCodes: ["05032"], corrections: [] },
  { cardId: cardId("05033"), cardSetCode: "basic", marvelcdbCodes: ["05033"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const MSM_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
