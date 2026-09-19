// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/iceman (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/iceman.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iceman.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iceman [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const ICEMAN_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("46001a"),
    cardSetCode: "iceman",
    marvelcdbCodes: ["46001a", "46001b"],
    corrections: [],
  },
  {
    cardId: cardId("46002"),
    cardSetCode: "iceman_frostbite",
    marvelcdbCodes: ["46002"],
    corrections: [
      "46002: Frostbite is a Permanent signature attachment, set aside by its own Forced Response rather than played for a resource cost: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap. [evidence: MarvelCDB card listing (marvelcdb.com/card/46002), \"Cost: —\"]",
    ],
  },
  {
    cardId: cardId("46003"),
    cardSetCode: "iceman",
    marvelcdbCodes: ["46003"],
    corrections: [
      "data decision: Snow Clone prints THW as a dash (cannot thwart) — confirmed from the card's own MarvelCDB listing (\"Attack: 2. Thwart: —.\"), not a transcription gap.",
    ],
  },
  { cardId: cardId("46004"), cardSetCode: "iceman", marvelcdbCodes: ["46004"], corrections: [] },
  { cardId: cardId("46005"), cardSetCode: "iceman", marvelcdbCodes: ["46005"], corrections: [] },
  { cardId: cardId("46006"), cardSetCode: "iceman", marvelcdbCodes: ["46006"], corrections: [] },
  { cardId: cardId("46007"), cardSetCode: "iceman", marvelcdbCodes: ["46007"], corrections: [] },
  { cardId: cardId("46008"), cardSetCode: "iceman", marvelcdbCodes: ["46008"], corrections: [] },
  { cardId: cardId("46009"), cardSetCode: "iceman", marvelcdbCodes: ["46009"], corrections: [] },
  { cardId: cardId("46010"), cardSetCode: "iceman", marvelcdbCodes: ["46010"], corrections: [] },
  { cardId: cardId("46011"), cardSetCode: "iceman", marvelcdbCodes: ["46011"], corrections: [] },
  { cardId: cardId("46012"), cardSetCode: "aggression", marvelcdbCodes: ["46012"], corrections: [] },
  { cardId: cardId("46013"), cardSetCode: "aggression", marvelcdbCodes: ["46013"], corrections: [] },
  { cardId: cardId("46014"), cardSetCode: "aggression", marvelcdbCodes: ["46014"], corrections: [] },
  { cardId: cardId("46015"), cardSetCode: "aggression", marvelcdbCodes: ["46015"], corrections: [] },
  { cardId: cardId("46016"), cardSetCode: "aggression", marvelcdbCodes: ["46016"], corrections: [] },
  {
    cardId: cardId("46017"),
    cardSetCode: "aggression",
    marvelcdbCodes: ["46017"],
    corrections: [],
    duplicateOfCardId: cardId("16043"),
  },
  { cardId: cardId("46018"), cardSetCode: "aggression", marvelcdbCodes: ["46018"], corrections: [] },
  { cardId: cardId("46019"), cardSetCode: "basic", marvelcdbCodes: ["46019"], corrections: [] },
  { cardId: cardId("46020"), cardSetCode: "basic", marvelcdbCodes: ["46020"], corrections: [] },
  {
    cardId: cardId("46021"),
    cardSetCode: "basic",
    marvelcdbCodes: ["46021"],
    corrections: [],
    duplicateOfCardId: cardId("12024"),
  },
  {
    cardId: cardId("46022"),
    cardSetCode: "basic",
    marvelcdbCodes: ["46022"],
    corrections: [],
    duplicateOfCardId: cardId("15031"),
  },
  {
    cardId: cardId("46023"),
    cardSetCode: "basic",
    marvelcdbCodes: ["46023"],
    corrections: [],
    duplicateOfCardId: cardId("13024"),
  },
  { cardId: cardId("46024"), cardSetCode: "iceman", marvelcdbCodes: ["46024"], corrections: [] },
  {
    cardId: cardId("46025"),
    cardSetCode: "iceman_nemesis",
    marvelcdbCodes: ["46025"],
    corrections: [],
  },
  {
    cardId: cardId("46026"),
    cardSetCode: "iceman_nemesis",
    marvelcdbCodes: ["46026"],
    corrections: [],
  },
  {
    cardId: cardId("46027"),
    cardSetCode: "iceman_nemesis",
    marvelcdbCodes: ["46027"],
    corrections: [],
  },
  {
    cardId: cardId("46028"),
    cardSetCode: "iceman_nemesis",
    marvelcdbCodes: ["46028"],
    corrections: [],
  },
  { cardId: cardId("46029"), cardSetCode: "sauron", marvelcdbCodes: ["46029"], corrections: [] },
  { cardId: cardId("46030"), cardSetCode: "sauron", marvelcdbCodes: ["46030"], corrections: [] },
  { cardId: cardId("46031"), cardSetCode: "sauron", marvelcdbCodes: ["46031"], corrections: [] },
  { cardId: cardId("46032"), cardSetCode: "sauron", marvelcdbCodes: ["46032"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const ICEMAN_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
