// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/bkw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/bkw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/bkw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack bkw [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const BKW_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("08001a"),
    cardSetCode: "black_widow",
    marvelcdbCodes: ["08001a", "08001b"],
    corrections: [
      "08001a: errata RRG 1.8 — Changed \"trigger\" to \"resolve\": \"Widowmaker\" now reads \"After you resolve the ability of a Preparation card you control...\". [evidence: RRG p.66 errata (\"Changed 'trigger' to 'resolve'.\"); ruling Feb 28 (2) (\"Both Black Widow and Synth-Suit should say 'resolve'.\"); MarvelCDB carries no `errata` field for this card and its text still reads \"trigger\" (verified as the un-updated print, not a second wording)]",
    ],
  },
  { cardId: cardId("08002"), cardSetCode: "black_widow", marvelcdbCodes: ["08002"], corrections: [] },
  { cardId: cardId("08003"), cardSetCode: "black_widow", marvelcdbCodes: ["08003"], corrections: [] },
  { cardId: cardId("08004"), cardSetCode: "black_widow", marvelcdbCodes: ["08004"], corrections: [] },
  { cardId: cardId("08005"), cardSetCode: "black_widow", marvelcdbCodes: ["08005"], corrections: [] },
  { cardId: cardId("08006"), cardSetCode: "black_widow", marvelcdbCodes: ["08006"], corrections: [] },
  { cardId: cardId("08007"), cardSetCode: "black_widow", marvelcdbCodes: ["08007"], corrections: [] },
  { cardId: cardId("08008"), cardSetCode: "black_widow", marvelcdbCodes: ["08008"], corrections: [] },
  {
    cardId: cardId("08009"),
    cardSetCode: "black_widow",
    marvelcdbCodes: ["08009"],
    corrections: [
      "08009: errata RRG 1.8 — Changed \"trigger\" to \"resolve\": Synth-Suit's Hero Response now reads \"After you resolve the ability of a Preparation card you control...\". [evidence: RRG p.66 errata; ruling Feb 28 (2); MarvelCDB text still reads \"trigger\" with no `errata` field set]",
    ],
  },
  { cardId: cardId("08010"), cardSetCode: "black_widow", marvelcdbCodes: ["08010"], corrections: [] },
  { cardId: cardId("08011"), cardSetCode: "justice", marvelcdbCodes: ["08011"], corrections: [] },
  { cardId: cardId("08012"), cardSetCode: "justice", marvelcdbCodes: ["08012"], corrections: [] },
  { cardId: cardId("08013"), cardSetCode: "justice", marvelcdbCodes: ["08013"], corrections: [] },
  { cardId: cardId("08014"), cardSetCode: "justice", marvelcdbCodes: ["08014"], corrections: [] },
  { cardId: cardId("08015"), cardSetCode: "justice", marvelcdbCodes: ["08015"], corrections: [] },
  { cardId: cardId("08016"), cardSetCode: "justice", marvelcdbCodes: ["08016"], corrections: [] },
  { cardId: cardId("08017"), cardSetCode: "justice", marvelcdbCodes: ["08017"], corrections: [] },
  { cardId: cardId("08018"), cardSetCode: "justice", marvelcdbCodes: ["08018"], corrections: [] },
  { cardId: cardId("08019"), cardSetCode: "basic", marvelcdbCodes: ["08019"], corrections: [] },
  { cardId: cardId("08020"), cardSetCode: "basic", marvelcdbCodes: ["08020"], corrections: [] },
  { cardId: cardId("08021"), cardSetCode: "basic", marvelcdbCodes: ["08021"], corrections: [] },
  { cardId: cardId("08022"), cardSetCode: "basic", marvelcdbCodes: ["08022"], corrections: [] },
  { cardId: cardId("08023"), cardSetCode: "basic", marvelcdbCodes: ["08023"], corrections: [] },
  { cardId: cardId("08024"), cardSetCode: "basic", marvelcdbCodes: ["08024"], corrections: [] },
  { cardId: cardId("08025"), cardSetCode: "black_widow", marvelcdbCodes: ["08025"], corrections: [] },
  {
    cardId: cardId("08026"),
    cardSetCode: "black_widow_nemesis",
    marvelcdbCodes: ["08026"],
    corrections: [
      "data decision: Taskmaster's printed ATK/SCH are 0★ (the ★ is a reminder that both are boosted by this card's own Boost ability, not a printed non-zero value). raw attack=0/scheme=0, not absent [evidence: raw; phase7 §1.12].",
    ],
  },
  {
    cardId: cardId("08027"),
    cardSetCode: "black_widow_nemesis",
    marvelcdbCodes: ["08027"],
    corrections: [],
  },
  {
    cardId: cardId("08028"),
    cardSetCode: "black_widow_nemesis",
    marvelcdbCodes: ["08028"],
    corrections: [
      "data decision: Guard minion (Hydra Mercenary). Printed SCH is 0 (not \"—\"): raw scheme=0, not absent [evidence: raw; phase7 §1.12].",
    ],
  },
  {
    cardId: cardId("08029"),
    cardSetCode: "black_widow_nemesis",
    marvelcdbCodes: ["08029"],
    corrections: [],
  },
  { cardId: cardId("08030"), cardSetCode: "aggression", marvelcdbCodes: ["08030"], corrections: [] },
  { cardId: cardId("08031"), cardSetCode: "leadership", marvelcdbCodes: ["08031"], corrections: [] },
  { cardId: cardId("08032"), cardSetCode: "protection", marvelcdbCodes: ["08032"], corrections: [] },
  { cardId: cardId("08033"), cardSetCode: "basic", marvelcdbCodes: ["08033"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const BKW_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
