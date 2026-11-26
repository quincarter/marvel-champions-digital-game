// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/iron_fist (fetched 2026-11-25; raw cache: packages/content/raw/marvelcdb/iron_fist.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/iron_fist.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack iron_fist [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const IRON_FIST_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("64001a"),
    cardSetCode: "iron_fist",
    marvelcdbCodes: ["64001a", "64001b"],
    corrections: [],
  },
  { cardId: cardId("64002"), cardSetCode: "iron_fist", marvelcdbCodes: ["64002"], corrections: [] },
  { cardId: cardId("64003"), cardSetCode: "iron_fist", marvelcdbCodes: ["64003"], corrections: [] },
  { cardId: cardId("64004"), cardSetCode: "iron_fist", marvelcdbCodes: ["64004"], corrections: [] },
  { cardId: cardId("64005"), cardSetCode: "iron_fist", marvelcdbCodes: ["64005"], corrections: [] },
  { cardId: cardId("64006"), cardSetCode: "iron_fist", marvelcdbCodes: ["64006"], corrections: [] },
  { cardId: cardId("64007"), cardSetCode: "iron_fist", marvelcdbCodes: ["64007"], corrections: [] },
  { cardId: cardId("64008"), cardSetCode: "iron_fist", marvelcdbCodes: ["64008"], corrections: [] },
  { cardId: cardId("64009"), cardSetCode: "iron_fist", marvelcdbCodes: ["64009"], corrections: [] },
  { cardId: cardId("64010"), cardSetCode: "iron_fist", marvelcdbCodes: ["64010"], corrections: [] },
  { cardId: cardId("64011"), cardSetCode: "iron_fist", marvelcdbCodes: ["64011"], corrections: [] },
  { cardId: cardId("64012"), cardSetCode: "iron_fist", marvelcdbCodes: ["64012"], corrections: [] },
  {
    cardId: cardId("64013"),
    cardSetCode: "protection",
    marvelcdbCodes: ["64013"],
    corrections: [
      "64013: THW and ATK print a dash: Helpful Bystander has no thwart or attack value (RRG 1.8 Dash (Value), p. 15). MarvelCDB sets attack_star and thwart_star on those stats; the card prints no star there (the icons under each dash are consequential-damage pips, moot under a dash). [evidence: Card image Iron_Fist_EN/64013_helpful_bystander.png: dash THW and ATK, one pip under each, no star.]",
      "data decision: Helpful Bystander: THW and ATK both print a dash (image), so it can neither thwart nor attack; HP 1 (Vulnerable). No thwart or attack value is emitted, as Hulk's dash THW (luke_cage 62020). The pip under each dash is a consequential-damage icon, moot under the dash.",
    ],
  },
  {
    cardId: cardId("64014"),
    cardSetCode: "protection",
    marvelcdbCodes: ["64014"],
    corrections: [
      "64014: MarvelCDB drops the consequential-damage icon that the printed text of Iron Fist (Lin Lie) carries after \"damage\" (our text token \"[cost]\"). [evidence: Card image Iron_Fist_EN/64014_*.png: \"consequential damage (icon)\".]",
    ],
  },
  {
    cardId: cardId("64015"),
    cardSetCode: "protection",
    marvelcdbCodes: ["64015"],
    corrections: [],
    duplicateOfCardId: cardId("26018"),
  },
  { cardId: cardId("64016"), cardSetCode: "protection", marvelcdbCodes: ["64016"], corrections: [] },
  {
    cardId: cardId("64017"),
    cardSetCode: "protection",
    marvelcdbCodes: ["64017"],
    corrections: [],
    duplicateOfCardId: cardId("09019"),
  },
  { cardId: cardId("64018"), cardSetCode: "protection", marvelcdbCodes: ["64018"], corrections: [] },
  { cardId: cardId("64019"), cardSetCode: "protection", marvelcdbCodes: ["64019"], corrections: [] },
  { cardId: cardId("64020"), cardSetCode: "protection", marvelcdbCodes: ["64020"], corrections: [] },
  {
    cardId: cardId("64021"),
    cardSetCode: "basic",
    marvelcdbCodes: ["64021"],
    corrections: [
      "64021: MarvelCDB drops the consequential-damage icon that the printed text of Colleen Wing carries after \"damage\" (our text token \"[cost]\"). [evidence: Card image Iron_Fist_EN/64021_*.png: \"consequential damage (icon)\".]",
    ],
  },
  { cardId: cardId("64022"), cardSetCode: "basic", marvelcdbCodes: ["64022"], corrections: [] },
  { cardId: cardId("64023"), cardSetCode: "basic", marvelcdbCodes: ["64023"], corrections: [] },
  {
    cardId: cardId("64024"),
    cardSetCode: "basic",
    marvelcdbCodes: ["64024"],
    corrections: [],
    duplicateOfCardId: cardId("62023"),
  },
  { cardId: cardId("64025"), cardSetCode: "basic", marvelcdbCodes: ["64025"], corrections: [] },
  { cardId: cardId("64026"), cardSetCode: "iron_fist", marvelcdbCodes: ["64026"], corrections: [] },
  {
    cardId: cardId("64027"),
    cardSetCode: "iron_fist_nemesis",
    marvelcdbCodes: ["64027"],
    corrections: [],
  },
  {
    cardId: cardId("64028"),
    cardSetCode: "iron_fist_nemesis",
    marvelcdbCodes: ["64028"],
    corrections: [],
  },
  {
    cardId: cardId("64029"),
    cardSetCode: "iron_fist_nemesis",
    marvelcdbCodes: ["64029"],
    corrections: [
      "data decision: Steel Serpent prints the acceleration icon, 4 threat per player and 2 boost icons (image); its Forced Interrupt gives Davos +3 ATK.",
    ],
  },
  { cardId: cardId("64030"), cardSetCode: "aggression", marvelcdbCodes: ["64030"], corrections: [] },
  { cardId: cardId("64031"), cardSetCode: "leadership", marvelcdbCodes: ["64031"], corrections: [] },
  {
    cardId: cardId("64032"),
    cardSetCode: "leadership",
    marvelcdbCodes: ["64032"],
    corrections: [
      "64032: MarvelCDB drops the consequential-damage icon that the printed text of Sensei carries after \"damage\" (our text token \"[cost]\"). [evidence: Card image Iron_Fist_EN/64032_*.png: \"consequential damage (icon)\".]",
    ],
  },
  { cardId: cardId("64033"), cardSetCode: "basic", marvelcdbCodes: ["64033"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const IRON_FIST_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
