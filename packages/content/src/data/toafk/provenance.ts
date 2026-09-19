// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/toafk (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/toafk.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/toafk.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack toafk [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const TOAFK_PROVENANCE: readonly CardProvenance[] = [
  { cardId: cardId("11001"), cardSetCode: "kang", marvelcdbCodes: ["11001"], corrections: [] },
  { cardId: cardId("11002"), cardSetCode: "kang", marvelcdbCodes: ["11002"], corrections: [] },
  { cardId: cardId("11003"), cardSetCode: "kang", marvelcdbCodes: ["11003"], corrections: [] },
  { cardId: cardId("11004"), cardSetCode: "kang", marvelcdbCodes: ["11004"], corrections: [] },
  {
    cardId: cardId("11005"),
    cardSetCode: "kang",
    marvelcdbCodes: ["11005"],
    corrections: [
      "data decision: Kang (Scarlet Centurion)'s SCH: docs/phase7-wave2.md §5.2 flagged this as printed with no SCH. Card image (marvelcdb.com/bundles/cards/11005.png) shows SCH 0 (starred); raw's scheme:0 already matches — confirmed correct, no correction applied.",
    ],
  },
  { cardId: cardId("11006"), cardSetCode: "kang", marvelcdbCodes: ["11006"], corrections: [] },
  {
    cardId: cardId("11007a"),
    cardSetCode: "kang",
    marvelcdbCodes: [
      "11007a",
      "11007b",
      "11008a",
      "11008b",
      "11009a",
      "11009b",
      "11010a",
      "11010b",
      "11011a",
      "11011b",
      "11012a",
      "11012b",
      "11013a",
      "11013b",
    ],
    corrections: [
      "11008a: MarvelCDB's own transcription typo: \"Each player reveals a random stage 3A in turn oder\" should read \"in turn order\". [evidence: raw (11008a); card image (marvelcdb.com/bundles/cards/11008a.png, confirms \"in turn order\"); docs/phase7-wave2.md §5.2]",
      "11008b: MarvelCDB's own transcription typo: \"When all the players have joined this game area, advanced to stage 4A\" should read \"advance to stage 4A\" — every parallel stage-3 ability reads \"advance\" (present tense; the ability itself triggers the advance). No image exists for this face; corrected on the strength of the identical, image-confirmed typo pattern on 11008a rather than its own scan. [evidence: raw (11008b); docs/phase7-wave2.md §5.2 (image not independently available for this face — see file header)]",
      "data decision: The Master of Time 2B's dashed starting/target/acceleration threat (docs/phase7-wave2.md §1.6) is not independently confirmed from a card scan — no image exists for 11008b on MarvelCDB (imagesrc null; direct fetch of 11008b.png/.jpg both 404). Read from the `_fixed: true` + null-value pattern, which is how the schema/normalizer distinguish a dash from a data gap; treat as high-confidence but unverified against a scan until one is found.",
    ],
  },
  { cardId: cardId("11014"), cardSetCode: "kang", marvelcdbCodes: ["11014"], corrections: [] },
  { cardId: cardId("11015"), cardSetCode: "kang", marvelcdbCodes: ["11015"], corrections: [] },
  { cardId: cardId("11016"), cardSetCode: "kang", marvelcdbCodes: ["11016"], corrections: [] },
  { cardId: cardId("11017"), cardSetCode: "kang", marvelcdbCodes: ["11017"], corrections: [] },
  { cardId: cardId("11018"), cardSetCode: "kang", marvelcdbCodes: ["11018"], corrections: [] },
  { cardId: cardId("11019"), cardSetCode: "kang", marvelcdbCodes: ["11019"], corrections: [] },
  { cardId: cardId("11020"), cardSetCode: "kang", marvelcdbCodes: ["11020"], corrections: [] },
  { cardId: cardId("11021"), cardSetCode: "kang", marvelcdbCodes: ["11021"], corrections: [] },
  { cardId: cardId("11022"), cardSetCode: "kang", marvelcdbCodes: ["11022"], corrections: [] },
  { cardId: cardId("11023"), cardSetCode: "kang", marvelcdbCodes: ["11023"], corrections: [] },
  { cardId: cardId("11024"), cardSetCode: "kang", marvelcdbCodes: ["11024"], corrections: [] },
  { cardId: cardId("11025"), cardSetCode: "kang", marvelcdbCodes: ["11025"], corrections: [] },
  { cardId: cardId("11026"), cardSetCode: "kang", marvelcdbCodes: ["11026"], corrections: [] },
  { cardId: cardId("11027"), cardSetCode: "kang", marvelcdbCodes: ["11027"], corrections: [] },
  { cardId: cardId("11028"), cardSetCode: "kang", marvelcdbCodes: ["11028"], corrections: [] },
  { cardId: cardId("11029"), cardSetCode: "kang", marvelcdbCodes: ["11029"], corrections: [] },
  { cardId: cardId("11030"), cardSetCode: "temporal", marvelcdbCodes: ["11030"], corrections: [] },
  { cardId: cardId("11031"), cardSetCode: "temporal", marvelcdbCodes: ["11031"], corrections: [] },
  { cardId: cardId("11032"), cardSetCode: "temporal", marvelcdbCodes: ["11032"], corrections: [] },
  { cardId: cardId("11033"), cardSetCode: "temporal", marvelcdbCodes: ["11033"], corrections: [] },
  { cardId: cardId("11034"), cardSetCode: "exp_kang", marvelcdbCodes: ["11034"], corrections: [] },
  { cardId: cardId("11035"), cardSetCode: "exp_kang", marvelcdbCodes: ["11035"], corrections: [] },
  { cardId: cardId("11036"), cardSetCode: "exp_kang", marvelcdbCodes: ["11036"], corrections: [] },
  { cardId: cardId("11037"), cardSetCode: "exp_kang", marvelcdbCodes: ["11037"], corrections: [] },
  {
    cardId: cardId("11038"),
    cardSetCode: "exp_kang",
    marvelcdbCodes: ["11038"],
    corrections: [
      "data decision: Kang (Scarlet Centurion), expert, SCH: card image (marvelcdb.com/bundles/cards/11038.png) shows SCH 1 (starred); raw's scheme:1 already matches — confirmed correct, no correction applied.",
    ],
  },
  { cardId: cardId("11039"), cardSetCode: "exp_kang", marvelcdbCodes: ["11039"], corrections: [] },
  { cardId: cardId("11040"), cardSetCode: "anachronauts", marvelcdbCodes: ["11040"], corrections: [] },
  { cardId: cardId("11041"), cardSetCode: "anachronauts", marvelcdbCodes: ["11041"], corrections: [] },
  { cardId: cardId("11042"), cardSetCode: "anachronauts", marvelcdbCodes: ["11042"], corrections: [] },
  { cardId: cardId("11043"), cardSetCode: "anachronauts", marvelcdbCodes: ["11043"], corrections: [] },
  { cardId: cardId("11044"), cardSetCode: "anachronauts", marvelcdbCodes: ["11044"], corrections: [] },
  { cardId: cardId("11045"), cardSetCode: "anachronauts", marvelcdbCodes: ["11045"], corrections: [] },
  { cardId: cardId("11046"), cardSetCode: "anachronauts", marvelcdbCodes: ["11046"], corrections: [] },
  { cardId: cardId("11047"), cardSetCode: "mot", marvelcdbCodes: ["11047"], corrections: [] },
  { cardId: cardId("11048"), cardSetCode: "mot", marvelcdbCodes: ["11048"], corrections: [] },
  { cardId: cardId("11049"), cardSetCode: "mot", marvelcdbCodes: ["11049"], corrections: [] },
  { cardId: cardId("11050"), cardSetCode: "mot", marvelcdbCodes: ["11050"], corrections: [] },
  { cardId: cardId("11051"), cardSetCode: "mot", marvelcdbCodes: ["11051"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const TOAFK_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [
  {
    marvelcdbCode: "11007",
    reason: "MarvelCDB aggregate record duplicating main scheme stage 11007a/11007b.",
  },
  {
    marvelcdbCode: "11008",
    reason: "MarvelCDB aggregate record duplicating main scheme stage 11008a/11008b.",
  },
  {
    marvelcdbCode: "11009",
    reason: "MarvelCDB aggregate record duplicating main scheme stage 11009a/11009b.",
  },
  {
    marvelcdbCode: "11010",
    reason: "MarvelCDB aggregate record duplicating main scheme stage 11010a/11010b.",
  },
  {
    marvelcdbCode: "11011",
    reason: "MarvelCDB aggregate record duplicating main scheme stage 11011a/11011b.",
  },
  {
    marvelcdbCode: "11012",
    reason: "MarvelCDB aggregate record duplicating main scheme stage 11012a/11012b.",
  },
  {
    marvelcdbCode: "11013",
    reason: "MarvelCDB aggregate record duplicating main scheme stage 11013a/11013b.",
  },
];
