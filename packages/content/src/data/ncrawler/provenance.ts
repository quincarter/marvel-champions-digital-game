// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/ncrawler (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/ncrawler.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/ncrawler.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack ncrawler [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const NCRAWLER_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("48001a"),
    cardSetCode: "nightcrawler",
    marvelcdbCodes: ["48001a", "48001b"],
    corrections: [],
  },
  { cardId: cardId("48002"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48002"], corrections: [] },
  { cardId: cardId("48003"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48003"], corrections: [] },
  {
    cardId: cardId("48004"),
    cardSetCode: "nightcrawler",
    marvelcdbCodes: ["48004"],
    corrections: [
      "data decision: Kurt's Cutlasses prints \"Counts as 2 restricted cards.\" (scan 48004.png read). Emitted as `restrictedWeight: 2` with one constant ability for the stat bonus, the Laser Swords model (`deadpool` 44055; docs/phase7-wave8.md §3.73).",
    ],
  },
  { cardId: cardId("48005"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48005"], corrections: [] },
  { cardId: cardId("48006"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48006"], corrections: [] },
  { cardId: cardId("48007"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48007"], corrections: [] },
  { cardId: cardId("48008"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48008"], corrections: [] },
  { cardId: cardId("48009"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48009"], corrections: [] },
  { cardId: cardId("48010"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48010"], corrections: [] },
  { cardId: cardId("48011"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48011"], corrections: [] },
  {
    cardId: cardId("48012"),
    cardSetCode: "protection",
    marvelcdbCodes: ["48012"],
    corrections: [
      "48012: errata RRG 1.8 — Rogue: \"printed THW and ATK\" is now \"base THW and ATK\". MarvelCDB (and the scan) carry the printed wording. [evidence: RRG 1.8 p. 69, Nightcrawler Hero Pack ROGUE (#12) errata; scan 48012.jpg read, prints \"printed THW and ATK\"]",
    ],
  },
  { cardId: cardId("48013"), cardSetCode: "protection", marvelcdbCodes: ["48013"], corrections: [] },
  { cardId: cardId("48014"), cardSetCode: "protection", marvelcdbCodes: ["48014"], corrections: [] },
  { cardId: cardId("48015"), cardSetCode: "protection", marvelcdbCodes: ["48015"], corrections: [] },
  { cardId: cardId("48016"), cardSetCode: "protection", marvelcdbCodes: ["48016"], corrections: [] },
  {
    cardId: cardId("48017"),
    cardSetCode: "protection",
    marvelcdbCodes: ["48017"],
    corrections: [],
    duplicateOfCardId: cardId("32014"),
  },
  { cardId: cardId("48018"), cardSetCode: "protection", marvelcdbCodes: ["48018"], corrections: [] },
  {
    cardId: cardId("48019"),
    cardSetCode: "protection",
    marvelcdbCodes: ["48019"],
    corrections: [],
    duplicateOfCardId: cardId("01079"),
  },
  { cardId: cardId("48020"), cardSetCode: "protection", marvelcdbCodes: ["48020"], corrections: [] },
  { cardId: cardId("48021"), cardSetCode: "basic", marvelcdbCodes: ["48021"], corrections: [] },
  {
    cardId: cardId("48022"),
    cardSetCode: "basic",
    marvelcdbCodes: ["48022"],
    corrections: [],
    duplicateOfCardId: cardId("38018"),
  },
  {
    cardId: cardId("48023"),
    cardSetCode: "basic",
    marvelcdbCodes: ["48023"],
    corrections: [],
    duplicateOfCardId: cardId("01088"),
  },
  {
    cardId: cardId("48024"),
    cardSetCode: "basic",
    marvelcdbCodes: ["48024"],
    corrections: [],
    duplicateOfCardId: cardId("01089"),
  },
  {
    cardId: cardId("48025"),
    cardSetCode: "basic",
    marvelcdbCodes: ["48025"],
    corrections: [],
    duplicateOfCardId: cardId("01090"),
  },
  { cardId: cardId("48026"), cardSetCode: "nightcrawler", marvelcdbCodes: ["48026"], corrections: [] },
  {
    cardId: cardId("48027"),
    cardSetCode: "nightcrawler_nemesis",
    marvelcdbCodes: ["48027"],
    corrections: [],
  },
  {
    cardId: cardId("48028"),
    cardSetCode: "nightcrawler_nemesis",
    marvelcdbCodes: ["48028"],
    corrections: [
      "48028: Brimstone Dimension prints one hazard icon beside its text; MarvelCDB sends scheme_hazard null, so the record emitted no icon. [evidence: scan 48028.png read: the scheme icon is the hazard icon (same glyph as Involuntary Procedures `deadpool` 44034); the three icons at the lower left are the boost icons (boost 3)]",
    ],
  },
  {
    cardId: cardId("48029"),
    cardSetCode: "nightcrawler_nemesis",
    marvelcdbCodes: ["48029"],
    corrections: [],
  },
  {
    cardId: cardId("48030"),
    cardSetCode: "nightcrawler_nemesis",
    marvelcdbCodes: ["48030"],
    corrections: [],
  },
  { cardId: cardId("48031"), cardSetCode: "aggression", marvelcdbCodes: ["48031"], corrections: [] },
  { cardId: cardId("48032"), cardSetCode: "justice", marvelcdbCodes: ["48032"], corrections: [] },
  {
    cardId: cardId("48033"),
    cardSetCode: "crazy_gang",
    marvelcdbCodes: ["48033"],
    corrections: [
      "48033: The Crazy Gang prints starting threat 2 with the per player icon; MarvelCDB sends base_threat_fixed true, so the threat emitted as a fixed 2. [evidence: scan 48033.png read: threat box prints 2 followed by the per player icon; one acceleration icon (same glyph as Killer for Hire `bkw` 08027), boost 2]",
    ],
  },
  { cardId: cardId("48034"), cardSetCode: "crazy_gang", marvelcdbCodes: ["48034"], corrections: [] },
  { cardId: cardId("48035"), cardSetCode: "crazy_gang", marvelcdbCodes: ["48035"], corrections: [] },
  { cardId: cardId("48036"), cardSetCode: "crazy_gang", marvelcdbCodes: ["48036"], corrections: [] },
  {
    cardId: cardId("48037"),
    cardSetCode: "crazy_gang",
    marvelcdbCodes: ["48037"],
    corrections: [
      "48037: errata RRG 1.8 — Tweedledope: the star icon was removed from the boost field. The printed card shows the star; current data has none (MarvelCDB boost_star false, no Boost ability). Text is unchanged. [evidence: RRG 1.8 p. 69, Nightcrawler Hero Pack TWEEDLEDOPE (#37) errata; scan 48037.jpg read, prints the star bottom right]",
    ],
  },
  { cardId: cardId("48038"), cardSetCode: "crazy_gang", marvelcdbCodes: ["48038"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const NCRAWLER_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
