// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/jj (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/jj.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/jj.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack jj [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const JJ_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("61001a"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61001a", "61001b"],
    corrections: [],
  },
  {
    cardId: cardId("61002"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61002"],
    corrections: [
      "61002: Alias Investigations is Permanent and enters play through Jessica Jones's Setup, never from a hand: raw sends no `cost` at all, the printed-dash pattern (RRG 1.8 Dash (Value), p. 15), as Ionic Physiology 58002. [evidence: Raw record (no cost); spec H1 corrections table; survey section 6. No local scan checked.]",
      "data decision: Alias Investigations: dash cost (Permanent; 61001b's Setup puts it into play), as Ionic Physiology 58002.",
    ],
  },
  {
    cardId: cardId("61003"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61003"],
    corrections: [],
  },
  {
    cardId: cardId("61004"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61004"],
    corrections: [],
  },
  {
    cardId: cardId("61005"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61005"],
    corrections: [],
  },
  {
    cardId: cardId("61006"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61006"],
    corrections: [],
  },
  {
    cardId: cardId("61007"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61007"],
    corrections: [],
  },
  {
    cardId: cardId("61008"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61008"],
    corrections: [],
  },
  {
    cardId: cardId("61009"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61009"],
    corrections: [],
  },
  {
    cardId: cardId("61010"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61010"],
    corrections: [],
  },
  {
    cardId: cardId("61011"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61011"],
    corrections: [],
  },
  {
    cardId: cardId("61012"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61012"],
    corrections: [],
  },
  {
    cardId: cardId("61013"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61013"],
    corrections: [],
  },
  {
    cardId: cardId("61014"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61014"],
    corrections: [],
  },
  { cardId: cardId("61015"), cardSetCode: "justice", marvelcdbCodes: ["61015"], corrections: [] },
  { cardId: cardId("61016"), cardSetCode: "justice", marvelcdbCodes: ["61016"], corrections: [] },
  { cardId: cardId("61017"), cardSetCode: "justice", marvelcdbCodes: ["61017"], corrections: [] },
  {
    cardId: cardId("61018"),
    cardSetCode: "justice",
    marvelcdbCodes: ["61018"],
    corrections: [],
    duplicateOfCardId: cardId("12031"),
  },
  { cardId: cardId("61019"), cardSetCode: "justice", marvelcdbCodes: ["61019"], corrections: [] },
  { cardId: cardId("61020"), cardSetCode: "justice", marvelcdbCodes: ["61020"], corrections: [] },
  {
    cardId: cardId("61021"),
    cardSetCode: "justice",
    marvelcdbCodes: ["61021"],
    corrections: [],
    duplicateOfCardId: cardId("41016"),
  },
  {
    cardId: cardId("61022"),
    cardSetCode: "justice",
    marvelcdbCodes: ["61022"],
    corrections: [],
    duplicateOfCardId: cardId("21052"),
  },
  { cardId: cardId("61023"), cardSetCode: "justice", marvelcdbCodes: ["61023"], corrections: [] },
  { cardId: cardId("61024"), cardSetCode: "justice", marvelcdbCodes: ["61024"], corrections: [] },
  { cardId: cardId("61025"), cardSetCode: "basic", marvelcdbCodes: ["61025"], corrections: [] },
  { cardId: cardId("61026"), cardSetCode: "basic", marvelcdbCodes: ["61026"], corrections: [] },
  { cardId: cardId("61027"), cardSetCode: "basic", marvelcdbCodes: ["61027"], corrections: [] },
  { cardId: cardId("61028"), cardSetCode: "basic", marvelcdbCodes: ["61028"], corrections: [] },
  { cardId: cardId("61029"), cardSetCode: "basic", marvelcdbCodes: ["61029"], corrections: [] },
  {
    cardId: cardId("61030"),
    cardSetCode: "jessica_jones",
    marvelcdbCodes: ["61030"],
    corrections: [],
  },
  {
    cardId: cardId("61031"),
    cardSetCode: "jessica_jones_nemesis",
    marvelcdbCodes: ["61031"],
    corrections: [
      "data decision: Purple Man: ATK and SCH print as a star and are set by his text (SCH = the highest SCH or THW among characters in play; ATK = the highest ATK). Emitted 0, not a dash, so the engine can stack modifiers on the computed value (spec H1, H3.10).",
    ],
  },
  {
    cardId: cardId("61032"),
    cardSetCode: "jessica_jones_nemesis",
    marvelcdbCodes: ["61032"],
    corrections: [],
  },
  {
    cardId: cardId("61033a"),
    cardSetCode: "jessica_jones_nemesis",
    marvelcdbCodes: ["61033a"],
    corrections: [
      "61033a: MarvelCDB names this card \"Suggestion ([energy])\"; the card's title is \"Suggestion\" and 61032 Indomitable Will refers to \"each Suggestion obligation\" by title. The resource icon is a printed qualifier of the text, not part of the title. [evidence: Spec H1 (corrections owed, \"unchecked, no scan\"); 61032 raw text \"each Suggestion obligation\"; 61033a-c raw text, which names the [energy] icon in its Forced Action.]",
    ],
  },
  {
    cardId: cardId("61033b"),
    cardSetCode: "jessica_jones_nemesis",
    marvelcdbCodes: ["61033b"],
    corrections: [
      "61033b: MarvelCDB names this card \"Suggestion ([mental])\"; the card's title is \"Suggestion\" and 61032 Indomitable Will refers to \"each Suggestion obligation\" by title. The resource icon is a printed qualifier of the text, not part of the title. [evidence: Spec H1 (corrections owed, \"unchecked, no scan\"); 61032 raw text \"each Suggestion obligation\"; 61033a-c raw text, which names the [mental] icon in its Forced Action.]",
    ],
  },
  {
    cardId: cardId("61033c"),
    cardSetCode: "jessica_jones_nemesis",
    marvelcdbCodes: ["61033c"],
    corrections: [
      "61033c: MarvelCDB names this card \"Suggestion ([physical])\"; the card's title is \"Suggestion\" and 61032 Indomitable Will refers to \"each Suggestion obligation\" by title. The resource icon is a printed qualifier of the text, not part of the title. [evidence: Spec H1 (corrections owed, \"unchecked, no scan\"); 61032 raw text \"each Suggestion obligation\"; 61033a-c raw text, which names the [physical] icon in its Forced Action.]",
    ],
  },
  { cardId: cardId("61034"), cardSetCode: "aggression", marvelcdbCodes: ["61034"], corrections: [] },
  { cardId: cardId("61035"), cardSetCode: "aggression", marvelcdbCodes: ["61035"], corrections: [] },
  { cardId: cardId("61036"), cardSetCode: "justice", marvelcdbCodes: ["61036"], corrections: [] },
  { cardId: cardId("61037"), cardSetCode: "leadership", marvelcdbCodes: ["61037"], corrections: [] },
  { cardId: cardId("61038"), cardSetCode: "protection", marvelcdbCodes: ["61038"], corrections: [] },
  { cardId: cardId("61039"), cardSetCode: "protection", marvelcdbCodes: ["61039"], corrections: [] },
  { cardId: cardId("61040"), cardSetCode: "protection", marvelcdbCodes: ["61040"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const JJ_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
