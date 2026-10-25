// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/wonder_man (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/wonder_man.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/wonder_man.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack wonder_man [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const WONDER_MAN_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("58001a"),
    cardSetCode: "wonder_man",
    marvelcdbCodes: ["58001a", "58001b"],
    corrections: [],
  },
  {
    cardId: cardId("58002"),
    cardSetCode: "wonder_man",
    marvelcdbCodes: ["58002"],
    corrections: [
      "58002: Ionic Physiology is Permanent, entering play through its own text rather than being paid for from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap. [evidence: MarvelCDB card listing (marvelcdb.com/card/58002), \"Cost: —\"]",
      "58002: errata RRG 1.8 — Ionic Physiology: the cost arrow before \"heal 1 damage from your identity\" became \"Then\" (tucking the event is no longer a cost). MarvelCDB and the card print the arrow; the printed text keeps it. [evidence: RRG 1.8 p. 70 (Wonder Man errata, IONIC PHYSIOLOGY (#2), docs/rules/mc_rulesreference_v18_compressed.md line 5150): \"Should read: Response: After you play an event with a printed [energy] resource, tuck that event from your discard pile under this card. Then, heal 1 damage from your identity. (Changed cost arrow to “Then”.)\"; ruling March 6, 2026 (3); scan 58002.png prints the arrow (scan check, \"Known errata\"). Raw text is the print.]",
    ],
  },
  { cardId: cardId("58003"), cardSetCode: "wonder_man", marvelcdbCodes: ["58003"], corrections: [] },
  { cardId: cardId("58004"), cardSetCode: "wonder_man", marvelcdbCodes: ["58004"], corrections: [] },
  { cardId: cardId("58005"), cardSetCode: "wonder_man", marvelcdbCodes: ["58005"], corrections: [] },
  { cardId: cardId("58006"), cardSetCode: "wonder_man", marvelcdbCodes: ["58006"], corrections: [] },
  { cardId: cardId("58007"), cardSetCode: "wonder_man", marvelcdbCodes: ["58007"], corrections: [] },
  { cardId: cardId("58008"), cardSetCode: "wonder_man", marvelcdbCodes: ["58008"], corrections: [] },
  { cardId: cardId("58009"), cardSetCode: "wonder_man", marvelcdbCodes: ["58009"], corrections: [] },
  { cardId: cardId("58010"), cardSetCode: "wonder_man", marvelcdbCodes: ["58010"], corrections: [] },
  { cardId: cardId("58011"), cardSetCode: "wonder_man", marvelcdbCodes: ["58011"], corrections: [] },
  { cardId: cardId("58012"), cardSetCode: "justice", marvelcdbCodes: ["58012"], corrections: [] },
  { cardId: cardId("58013"), cardSetCode: "justice", marvelcdbCodes: ["58013"], corrections: [] },
  { cardId: cardId("58014"), cardSetCode: "justice", marvelcdbCodes: ["58014"], corrections: [] },
  { cardId: cardId("58015"), cardSetCode: "justice", marvelcdbCodes: ["58015"], corrections: [] },
  { cardId: cardId("58016"), cardSetCode: "justice", marvelcdbCodes: ["58016"], corrections: [] },
  {
    cardId: cardId("58017"),
    cardSetCode: "aggression",
    marvelcdbCodes: ["58017"],
    corrections: [],
    duplicateOfCardId: cardId("42029"),
  },
  { cardId: cardId("58018"), cardSetCode: "justice", marvelcdbCodes: ["58018"], corrections: [] },
  { cardId: cardId("58019"), cardSetCode: "protection", marvelcdbCodes: ["58019"], corrections: [] },
  { cardId: cardId("58020"), cardSetCode: "leadership", marvelcdbCodes: ["58020"], corrections: [] },
  { cardId: cardId("58021"), cardSetCode: "justice", marvelcdbCodes: ["58021"], corrections: [] },
  { cardId: cardId("58022"), cardSetCode: "basic", marvelcdbCodes: ["58022"], corrections: [] },
  {
    cardId: cardId("58023"),
    cardSetCode: "basic",
    marvelcdbCodes: ["58023"],
    corrections: [],
    duplicateOfCardId: cardId("01088"),
  },
  { cardId: cardId("58024"), cardSetCode: "basic", marvelcdbCodes: ["58024"], corrections: [] },
  { cardId: cardId("58025"), cardSetCode: "wonder_man", marvelcdbCodes: ["58025"], corrections: [] },
  {
    cardId: cardId("58026"),
    cardSetCode: "wonder_man_nemesis",
    marvelcdbCodes: ["58026"],
    corrections: [
      "58026: Grim Reaper is Wonder Man's nemesis minion (the only minion of the wonder_man_nemesis set, 58026 to 58029) but prints no Nemesis reminder line, so the parser cannot set the flag. Without it, \"your nemesis minion\" finds nothing for Wonder Man. Never applied to text. [evidence: raw/marvelcdb/wonder_man.json: 58026 is the one minion in wonder_man_nemesis and its text carries no reminder line (Ares 59036 and The Hood 56024 print one); same fix as cw 56055 (docs/phase7-wave10-box-heroes.md B8.1).]",
    ],
  },
  {
    cardId: cardId("58027"),
    cardSetCode: "wonder_man_nemesis",
    marvelcdbCodes: ["58027"],
    corrections: [],
  },
  {
    cardId: cardId("58028"),
    cardSetCode: "wonder_man_nemesis",
    marvelcdbCodes: ["58028"],
    corrections: [],
  },
  {
    cardId: cardId("58029"),
    cardSetCode: "wonder_man_nemesis",
    marvelcdbCodes: ["58029"],
    corrections: [],
  },
  { cardId: cardId("58030"), cardSetCode: "aggression", marvelcdbCodes: ["58030"], corrections: [] },
  {
    cardId: cardId("58031"),
    cardSetCode: "leadership",
    marvelcdbCodes: ["58031"],
    corrections: [
      "58031: Cameo is a Setup: search-and-attach support, never played for a resource cost: raw sends no `cost` at all — same reasoning as 58002. [evidence: MarvelCDB card listing (marvelcdb.com/card/58031), \"Cost: —\"]",
    ],
  },
  { cardId: cardId("58032"), cardSetCode: "leadership", marvelcdbCodes: ["58032"], corrections: [] },
  { cardId: cardId("58033"), cardSetCode: "protection", marvelcdbCodes: ["58033"], corrections: [] },
  { cardId: cardId("58034"), cardSetCode: "basic", marvelcdbCodes: ["58034"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const WONDER_MAN_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
