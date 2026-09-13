// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/cap (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/cap.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/cap.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack cap [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const CAP_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("03001a"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03001a", "03001b"],
    corrections: [],
  },
  {
    cardId: cardId("03002"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03002"],
    corrections: [],
  },
  {
    cardId: cardId("03003"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03003"],
    corrections: [],
  },
  {
    cardId: cardId("03004"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03004"],
    corrections: [],
  },
  {
    cardId: cardId("03005"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03005"],
    corrections: [],
  },
  {
    cardId: cardId("03006"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03006"],
    corrections: [],
  },
  {
    cardId: cardId("03007"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03007"],
    corrections: [],
  },
  {
    cardId: cardId("03008"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03008"],
    corrections: [],
  },
  {
    cardId: cardId("03009"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03009"],
    corrections: [],
  },
  {
    cardId: cardId("03010"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03010"],
    corrections: [],
  },
  { cardId: cardId("03011"), cardSetCode: "leadership", marvelcdbCodes: ["03011"], corrections: [] },
  { cardId: cardId("03012"), cardSetCode: "leadership", marvelcdbCodes: ["03012"], corrections: [] },
  { cardId: cardId("03013"), cardSetCode: "leadership", marvelcdbCodes: ["03013"], corrections: [] },
  { cardId: cardId("03014"), cardSetCode: "leadership", marvelcdbCodes: ["03014"], corrections: [] },
  {
    cardId: cardId("03015"),
    cardSetCode: "leadership",
    marvelcdbCodes: ["03015"],
    corrections: [
      "data decision: MarvelCDB's raw text has a stray closing </i> tag after \"Hero Action</b>\" with no matching open tag. No effect on the emitted card text — toPlainText strips all HTML tags unconditionally, so this never reaches a Correction's textReplace (which runs on the already-stripped text); recorded here only so the source anomaly is documented [evidence: raw; phase7 §1.12].",
    ],
  },
  { cardId: cardId("03016"), cardSetCode: "leadership", marvelcdbCodes: ["03016"], corrections: [] },
  {
    cardId: cardId("03017"),
    cardSetCode: "leadership",
    marvelcdbCodes: ["03017"],
    corrections: [
      "03017: MarvelCDB capitalizes \"In\"; the printed title lowercases it, confirmed on the deck's own printed decklist. [evidence: deck photo (\"17 Strength in Numbers x3\")]",
    ],
  },
  { cardId: cardId("03018"), cardSetCode: "leadership", marvelcdbCodes: ["03018"], corrections: [] },
  { cardId: cardId("03019"), cardSetCode: "leadership", marvelcdbCodes: ["03019"], corrections: [] },
  { cardId: cardId("03020"), cardSetCode: "basic", marvelcdbCodes: ["03020"], corrections: [] },
  { cardId: cardId("03021"), cardSetCode: "basic", marvelcdbCodes: ["03021"], corrections: [] },
  { cardId: cardId("03022"), cardSetCode: "basic", marvelcdbCodes: ["03022"], corrections: [] },
  { cardId: cardId("03023"), cardSetCode: "basic", marvelcdbCodes: ["03023"], corrections: [] },
  { cardId: cardId("03024"), cardSetCode: "basic", marvelcdbCodes: ["03024"], corrections: [] },
  {
    cardId: cardId("03025"),
    cardSetCode: "basic",
    marvelcdbCodes: ["03025"],
    corrections: [
      "data decision: Honorary Avenger errata (RRG 1.8 p.65) added \"Max 1 per character.\" on top of the printed \"Play only if your identity has the Avenger trait.\" — data only carries the current playRestrictions shape (maxPerHost + requiresIdentityTrait); MarvelCDB's text already reflects the current wording.",
    ],
  },
  {
    cardId: cardId("03026"),
    cardSetCode: "captain_america",
    marvelcdbCodes: ["03026"],
    corrections: [],
  },
  {
    cardId: cardId("03027"),
    cardSetCode: "captain_america_nemesis",
    marvelcdbCodes: ["03027"],
    corrections: [],
  },
  {
    cardId: cardId("03028"),
    cardSetCode: "captain_america_nemesis",
    marvelcdbCodes: ["03028"],
    corrections: [],
  },
  {
    cardId: cardId("03029"),
    cardSetCode: "captain_america_nemesis",
    marvelcdbCodes: ["03029"],
    corrections: [],
  },
  {
    cardId: cardId("03030"),
    cardSetCode: "captain_america_nemesis",
    marvelcdbCodes: ["03030"],
    corrections: [],
  },
  { cardId: cardId("03031"), cardSetCode: "aggression", marvelcdbCodes: ["03031"], corrections: [] },
  { cardId: cardId("03032"), cardSetCode: "justice", marvelcdbCodes: ["03032"], corrections: [] },
  { cardId: cardId("03033"), cardSetCode: "protection", marvelcdbCodes: ["03033"], corrections: [] },
  { cardId: cardId("03034"), cardSetCode: "basic", marvelcdbCodes: ["03034"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const CAP_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
