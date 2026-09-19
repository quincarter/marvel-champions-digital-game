// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/storm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/storm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/storm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack storm [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const STORM_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("36001a"),
    cardSetCode: "storm",
    marvelcdbCodes: ["36001a", "36001b"],
    corrections: [],
  },
  {
    cardId: cardId("36002"),
    cardSetCode: "storm_weather_deck",
    marvelcdbCodes: ["36002"],
    corrections: [
      "36002: Clear Skies is one of the Weather Deck's four Permanent supports, swapped into play by their own Special ability rather than played from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap. [evidence: MarvelCDB card listing (marvelcdb.com/card/36002), \"Cost: —\"]",
    ],
  },
  {
    cardId: cardId("36003"),
    cardSetCode: "storm_weather_deck",
    marvelcdbCodes: ["36003"],
    corrections: [
      "36003: Hurricane — same Weather Deck reasoning as 36002. [evidence: MarvelCDB card listing (marvelcdb.com/card/36003), \"Cost: —\"]",
    ],
  },
  {
    cardId: cardId("36004"),
    cardSetCode: "storm_weather_deck",
    marvelcdbCodes: ["36004"],
    corrections: [
      "36004: Thunderstorm — same Weather Deck reasoning as 36002. [evidence: MarvelCDB card listing (marvelcdb.com/card/36004), \"Cost: —\"]",
    ],
  },
  {
    cardId: cardId("36005"),
    cardSetCode: "storm_weather_deck",
    marvelcdbCodes: ["36005"],
    corrections: [
      "36005: Blizzard — same Weather Deck reasoning as 36002. [evidence: MarvelCDB card listing (marvelcdb.com/card/36005), \"Cost: —\"]",
    ],
  },
  { cardId: cardId("36006"), cardSetCode: "storm", marvelcdbCodes: ["36006"], corrections: [] },
  { cardId: cardId("36007"), cardSetCode: "storm", marvelcdbCodes: ["36007"], corrections: [] },
  { cardId: cardId("36008"), cardSetCode: "storm", marvelcdbCodes: ["36008"], corrections: [] },
  { cardId: cardId("36009"), cardSetCode: "storm", marvelcdbCodes: ["36009"], corrections: [] },
  { cardId: cardId("36010"), cardSetCode: "storm", marvelcdbCodes: ["36010"], corrections: [] },
  { cardId: cardId("36011"), cardSetCode: "storm", marvelcdbCodes: ["36011"], corrections: [] },
  { cardId: cardId("36012"), cardSetCode: "storm", marvelcdbCodes: ["36012"], corrections: [] },
  { cardId: cardId("36013"), cardSetCode: "storm", marvelcdbCodes: ["36013"], corrections: [] },
  { cardId: cardId("36014"), cardSetCode: "leadership", marvelcdbCodes: ["36014"], corrections: [] },
  { cardId: cardId("36015"), cardSetCode: "leadership", marvelcdbCodes: ["36015"], corrections: [] },
  { cardId: cardId("36016"), cardSetCode: "leadership", marvelcdbCodes: ["36016"], corrections: [] },
  { cardId: cardId("36017"), cardSetCode: "leadership", marvelcdbCodes: ["36017"], corrections: [] },
  { cardId: cardId("36018"), cardSetCode: "leadership", marvelcdbCodes: ["36018"], corrections: [] },
  { cardId: cardId("36019"), cardSetCode: "leadership", marvelcdbCodes: ["36019"], corrections: [] },
  { cardId: cardId("36020"), cardSetCode: "leadership", marvelcdbCodes: ["36020"], corrections: [] },
  {
    cardId: cardId("36021"),
    cardSetCode: "leadership",
    marvelcdbCodes: ["36021"],
    corrections: [],
    duplicateOfCardId: cardId("33018"),
  },
  { cardId: cardId("36022"), cardSetCode: "basic", marvelcdbCodes: ["36022"], corrections: [] },
  {
    cardId: cardId("36023"),
    cardSetCode: "basic",
    marvelcdbCodes: ["36023"],
    corrections: [],
    duplicateOfCardId: cardId("32020"),
  },
  {
    cardId: cardId("36024"),
    cardSetCode: "basic",
    marvelcdbCodes: ["36024"],
    corrections: [],
    duplicateOfCardId: cardId("33020"),
  },
  {
    cardId: cardId("36025"),
    cardSetCode: "basic",
    marvelcdbCodes: ["36025"],
    corrections: [],
    duplicateOfCardId: cardId("32049"),
  },
  {
    cardId: cardId("36026"),
    cardSetCode: "basic",
    marvelcdbCodes: ["36026"],
    corrections: [],
    duplicateOfCardId: cardId("05023"),
  },
  {
    cardId: cardId("36027"),
    cardSetCode: "basic",
    marvelcdbCodes: ["36027"],
    corrections: [],
    duplicateOfCardId: cardId("01088"),
  },
  {
    cardId: cardId("36028"),
    cardSetCode: "basic",
    marvelcdbCodes: ["36028"],
    corrections: [],
    duplicateOfCardId: cardId("01089"),
  },
  {
    cardId: cardId("36029"),
    cardSetCode: "basic",
    marvelcdbCodes: ["36029"],
    corrections: [],
    duplicateOfCardId: cardId("01090"),
  },
  { cardId: cardId("36030"), cardSetCode: "storm", marvelcdbCodes: ["36030"], corrections: [] },
  {
    cardId: cardId("36031"),
    cardSetCode: "storm_nemesis",
    marvelcdbCodes: ["36031"],
    corrections: [],
  },
  {
    cardId: cardId("36032"),
    cardSetCode: "storm_nemesis",
    marvelcdbCodes: ["36032"],
    corrections: [],
  },
  {
    cardId: cardId("36033"),
    cardSetCode: "storm_nemesis",
    marvelcdbCodes: ["36033"],
    corrections: [],
  },
  {
    cardId: cardId("36034"),
    cardSetCode: "storm_nemesis",
    marvelcdbCodes: ["36034"],
    corrections: [],
  },
  { cardId: cardId("36035"), cardSetCode: "protection", marvelcdbCodes: ["36035"], corrections: [] },
  { cardId: cardId("36036"), cardSetCode: "shadow_king", marvelcdbCodes: ["36036"], corrections: [] },
  { cardId: cardId("36037"), cardSetCode: "shadow_king", marvelcdbCodes: ["36037"], corrections: [] },
  { cardId: cardId("36038"), cardSetCode: "shadow_king", marvelcdbCodes: ["36038"], corrections: [] },
  { cardId: cardId("36039"), cardSetCode: "shadow_king", marvelcdbCodes: ["36039"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const STORM_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
