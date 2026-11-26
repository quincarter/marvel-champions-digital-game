// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/elektra (fetched 2026-11-25; raw cache: packages/content/raw/marvelcdb/elektra.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/elektra.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack elektra [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const ELEKTRA_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("63001a"),
    cardSetCode: "elektra",
    marvelcdbCodes: ["63001a", "63001b"],
    corrections: [],
  },
  {
    cardId: cardId("63002"),
    cardSetCode: "elektra_ninja_deck",
    marvelcdbCodes: ["63002"],
    corrections: [],
  },
  {
    cardId: cardId("63003"),
    cardSetCode: "elektra_ninja_deck",
    marvelcdbCodes: ["63003"],
    corrections: [],
  },
  {
    cardId: cardId("63004"),
    cardSetCode: "elektra_ninja_deck",
    marvelcdbCodes: ["63004"],
    corrections: [],
  },
  { cardId: cardId("63005"), cardSetCode: "elektra", marvelcdbCodes: ["63005"], corrections: [] },
  { cardId: cardId("63006"), cardSetCode: "elektra", marvelcdbCodes: ["63006"], corrections: [] },
  { cardId: cardId("63007"), cardSetCode: "elektra", marvelcdbCodes: ["63007"], corrections: [] },
  { cardId: cardId("63008"), cardSetCode: "elektra", marvelcdbCodes: ["63008"], corrections: [] },
  { cardId: cardId("63009"), cardSetCode: "elektra", marvelcdbCodes: ["63009"], corrections: [] },
  { cardId: cardId("63010"), cardSetCode: "elektra", marvelcdbCodes: ["63010"], corrections: [] },
  { cardId: cardId("63011"), cardSetCode: "elektra", marvelcdbCodes: ["63011"], corrections: [] },
  { cardId: cardId("63012"), cardSetCode: "elektra", marvelcdbCodes: ["63012"], corrections: [] },
  { cardId: cardId("63013"), cardSetCode: "elektra", marvelcdbCodes: ["63013"], corrections: [] },
  { cardId: cardId("63014"), cardSetCode: "elektra", marvelcdbCodes: ["63014"], corrections: [] },
  { cardId: cardId("63015"), cardSetCode: "aggression", marvelcdbCodes: ["63015"], corrections: [] },
  { cardId: cardId("63016"), cardSetCode: "aggression", marvelcdbCodes: ["63016"], corrections: [] },
  { cardId: cardId("63017"), cardSetCode: "aggression", marvelcdbCodes: ["63017"], corrections: [] },
  { cardId: cardId("63018"), cardSetCode: "aggression", marvelcdbCodes: ["63018"], corrections: [] },
  { cardId: cardId("63019"), cardSetCode: "aggression", marvelcdbCodes: ["63019"], corrections: [] },
  { cardId: cardId("63020"), cardSetCode: "aggression", marvelcdbCodes: ["63020"], corrections: [] },
  { cardId: cardId("63021"), cardSetCode: "aggression", marvelcdbCodes: ["63021"], corrections: [] },
  { cardId: cardId("63022"), cardSetCode: "basic", marvelcdbCodes: ["63022"], corrections: [] },
  { cardId: cardId("63023"), cardSetCode: "basic", marvelcdbCodes: ["63023"], corrections: [] },
  {
    cardId: cardId("63024"),
    cardSetCode: "basic",
    marvelcdbCodes: ["63024"],
    corrections: [],
    duplicateOfCardId: cardId("01088"),
  },
  {
    cardId: cardId("63025"),
    cardSetCode: "basic",
    marvelcdbCodes: ["63025"],
    corrections: [],
    duplicateOfCardId: cardId("01089"),
  },
  {
    cardId: cardId("63026"),
    cardSetCode: "basic",
    marvelcdbCodes: ["63026"],
    corrections: [],
    duplicateOfCardId: cardId("01090"),
  },
  {
    cardId: cardId("63027"),
    cardSetCode: "basic",
    marvelcdbCodes: ["63027"],
    corrections: [
      "63027: MarvelCDB sends no `scheme_amplify` for the reprint, but the card prints the amplify icon centred under the text box, as its original 60031 (whose record carries `scheme_amplify: 1`). [evidence: Official card image Elektra_EN/63027_dance_with_the_devil.png (amplify icon under the text); raw/marvelcdb/fne.json 60031 scheme_amplify 1.]",
    ],
    duplicateOfCardId: cardId("60031"),
  },
  { cardId: cardId("63028"), cardSetCode: "elektra", marvelcdbCodes: ["63028"], corrections: [] },
  {
    cardId: cardId("63029"),
    cardSetCode: "elektra_nemesis",
    marvelcdbCodes: ["63029"],
    corrections: [],
  },
  {
    cardId: cardId("63030"),
    cardSetCode: "elektra_nemesis",
    marvelcdbCodes: ["63030"],
    corrections: [
      "data decision: The Fist Fits in the Hand: the icon under the text box is the hazard icon (MarvelCDB scheme_hazard 1; the card shows a black plus-and-card icon), 3 per hero starting threat, 3 boost icons.",
    ],
  },
  {
    cardId: cardId("63031"),
    cardSetCode: "elektra_nemesis",
    marvelcdbCodes: ["63031"],
    corrections: [],
  },
  {
    cardId: cardId("63032"),
    cardSetCode: "elektra_nemesis",
    marvelcdbCodes: ["63032"],
    corrections: [],
  },
  {
    cardId: cardId("63033"),
    cardSetCode: "elektra_nemesis",
    marvelcdbCodes: ["63033"],
    corrections: [],
  },
  { cardId: cardId("63034"), cardSetCode: "justice", marvelcdbCodes: ["63034"], corrections: [] },
  { cardId: cardId("63035"), cardSetCode: "justice", marvelcdbCodes: ["63035"], corrections: [] },
  { cardId: cardId("63036"), cardSetCode: "justice", marvelcdbCodes: ["63036"], corrections: [] },
  { cardId: cardId("63037"), cardSetCode: "justice", marvelcdbCodes: ["63037"], corrections: [] },
  {
    cardId: cardId("63038"),
    cardSetCode: "leadership",
    marvelcdbCodes: ["63038"],
    corrections: [
      "63038: MarvelCDB drops the cost icon from Moondragon's text; the card prints \"takes +X consequential damage ([cost]) for this use\" (the consequential-damage icon in parentheses, as on her stat boxes). [evidence: Official card image Elektra_EN/63038_moondragon.png: \"Moondragon gets +X to that power and takes +X consequential damage ([cost]) for this use, where X is equal to the chosen number.\"]",
    ],
  },
  { cardId: cardId("63039"), cardSetCode: "protection", marvelcdbCodes: ["63039"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const ELEKTRA_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
