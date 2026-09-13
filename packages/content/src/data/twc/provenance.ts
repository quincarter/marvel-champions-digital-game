// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/twc (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/twc.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/twc.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack twc [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const TWC_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("07001a"),
    cardSetCode: "wrecking_crew",
    marvelcdbCodes: ["07001a", "07001b"],
    corrections: [],
  },
  {
    cardId: cardId("07002"),
    cardSetCode: "wrecker",
    marvelcdbCodes: ["07002", "07003"],
    corrections: [
      "data decision: Wrecker A/B, single-sided (no Norman-Osborn-style flip). Signature side scheme: Day of Reckoning (07004).",
    ],
  },
  { cardId: cardId("07004"), cardSetCode: "wrecker", marvelcdbCodes: ["07004"], corrections: [] },
  {
    cardId: cardId("07005"),
    cardSetCode: "wrecker",
    marvelcdbCodes: ["07005"],
    corrections: [
      "07005: MarvelCDB typo on the Wrecker copy of Held Hostage only; the other three copies (07021/07036/07050) all read \"attached scheme\" — this is the odd one out, not a printed variation. [evidence: raw (07021/07036/07050 all read \"attached scheme\"); phase7 §1.12]",
    ],
  },
  { cardId: cardId("07006"), cardSetCode: "wrecker", marvelcdbCodes: ["07006"], corrections: [] },
  { cardId: cardId("07007"), cardSetCode: "wrecker", marvelcdbCodes: ["07007"], corrections: [] },
  {
    cardId: cardId("07008"),
    cardSetCode: "wrecker",
    marvelcdbCodes: ["07008"],
    corrections: [
      "data decision: Guard minion (Corrupt Prison Guard, Wrecker deck copy). Printed SCH is 0 (not \"—\"): raw scheme=0, not absent [evidence: raw; phase7 §1.12].",
    ],
  },
  { cardId: cardId("07009"), cardSetCode: "wrecker", marvelcdbCodes: ["07009"], corrections: [] },
  { cardId: cardId("07010"), cardSetCode: "wrecker", marvelcdbCodes: ["07010"], corrections: [] },
  { cardId: cardId("07011"), cardSetCode: "wrecker", marvelcdbCodes: ["07011"], corrections: [] },
  { cardId: cardId("07012"), cardSetCode: "wrecker", marvelcdbCodes: ["07012"], corrections: [] },
  { cardId: cardId("07013"), cardSetCode: "wrecker", marvelcdbCodes: ["07013"], corrections: [] },
  { cardId: cardId("07014"), cardSetCode: "wrecker", marvelcdbCodes: ["07014"], corrections: [] },
  { cardId: cardId("07015"), cardSetCode: "wrecker", marvelcdbCodes: ["07015"], corrections: [] },
  { cardId: cardId("07016"), cardSetCode: "wrecker", marvelcdbCodes: ["07016"], corrections: [] },
  {
    cardId: cardId("07017"),
    cardSetCode: "thunderball",
    marvelcdbCodes: ["07017", "07018"],
    corrections: ["data decision: Thunderball A/B, single-sided. Signature side scheme: Thunderstruck (07019)."],
  },
  { cardId: cardId("07019"), cardSetCode: "thunderball", marvelcdbCodes: ["07019"], corrections: [] },
  { cardId: cardId("07020"), cardSetCode: "thunderball", marvelcdbCodes: ["07020"], corrections: [] },
  { cardId: cardId("07021"), cardSetCode: "thunderball", marvelcdbCodes: ["07021"], corrections: [] },
  { cardId: cardId("07022"), cardSetCode: "thunderball", marvelcdbCodes: ["07022"], corrections: [] },
  {
    cardId: cardId("07023"),
    cardSetCode: "thunderball",
    marvelcdbCodes: ["07023"],
    corrections: [
      "data decision: Guard minion (Corrupt Prison Guard, Thunderball deck copy). Printed SCH is 0, same as 07008.",
    ],
  },
  { cardId: cardId("07024"), cardSetCode: "thunderball", marvelcdbCodes: ["07024"], corrections: [] },
  { cardId: cardId("07025"), cardSetCode: "thunderball", marvelcdbCodes: ["07025"], corrections: [] },
  { cardId: cardId("07026"), cardSetCode: "thunderball", marvelcdbCodes: ["07026"], corrections: [] },
  { cardId: cardId("07027"), cardSetCode: "thunderball", marvelcdbCodes: ["07027"], corrections: [] },
  { cardId: cardId("07028"), cardSetCode: "thunderball", marvelcdbCodes: ["07028"], corrections: [] },
  { cardId: cardId("07029"), cardSetCode: "thunderball", marvelcdbCodes: ["07029"], corrections: [] },
  { cardId: cardId("07030"), cardSetCode: "thunderball", marvelcdbCodes: ["07030"], corrections: [] },
  { cardId: cardId("07031"), cardSetCode: "thunderball", marvelcdbCodes: ["07031"], corrections: [] },
  {
    cardId: cardId("07032"),
    cardSetCode: "piledriver",
    marvelcdbCodes: ["07032", "07033"],
    corrections: ["data decision: Piledriver A/B, single-sided. Signature side scheme: Pile It On! (07034)."],
  },
  {
    cardId: cardId("07034"),
    cardSetCode: "piledriver",
    marvelcdbCodes: ["07034"],
    corrections: [
      "07034: Pile It On! is Piledriver's signature side scheme (its own \"Piledriver's Side Scheme.\" line, immediately above); MarvelCDB's text names the wrong villain. The printed card, per the Wrecking Crew insert's setup diagram, reads \"while Piledriver is in play\". [evidence: insert setup diagram (quoted docs/phase7-wave1.md §1.12); raw (the card's own preceding \"Piledriver's Side Scheme.\" line contradicts MarvelCDB's \"Wrecker\")]",
    ],
  },
  { cardId: cardId("07035"), cardSetCode: "piledriver", marvelcdbCodes: ["07035"], corrections: [] },
  {
    cardId: cardId("07036"),
    cardSetCode: "piledriver",
    marvelcdbCodes: ["07036"],
    corrections: [
      "07036: MarvelCDB drops the possessive on the Piledriver copy of Held Hostage. Without it the parser's attach-rule matcher falls through to a generic \"the (.+) side scheme\" pattern and produces the wrong AttachmentHost (a bogus namedCard \"active villain\" instead of villainSideScheme) — confirmed by parsing this exact sentence before and after the fix. The Wrecker/Thunderball copies (07005/07021) already print the apostrophe. [evidence: raw (07005/07021 read \"the active villain's side scheme\"); phase7 §1.12; parser behavior verified directly against parseCardText]",
    ],
  },
  {
    cardId: cardId("07037"),
    cardSetCode: "piledriver",
    marvelcdbCodes: ["07037"],
    corrections: [
      "data decision: Guard minion (Corrupt Prison Guard, Piledriver deck copy). Printed SCH is 0, same as 07008.",
    ],
  },
  { cardId: cardId("07038"), cardSetCode: "piledriver", marvelcdbCodes: ["07038"], corrections: [] },
  { cardId: cardId("07039"), cardSetCode: "piledriver", marvelcdbCodes: ["07039"], corrections: [] },
  { cardId: cardId("07040"), cardSetCode: "piledriver", marvelcdbCodes: ["07040"], corrections: [] },
  { cardId: cardId("07041"), cardSetCode: "piledriver", marvelcdbCodes: ["07041"], corrections: [] },
  { cardId: cardId("07042"), cardSetCode: "piledriver", marvelcdbCodes: ["07042"], corrections: [] },
  { cardId: cardId("07043"), cardSetCode: "piledriver", marvelcdbCodes: ["07043"], corrections: [] },
  { cardId: cardId("07044"), cardSetCode: "piledriver", marvelcdbCodes: ["07044"], corrections: [] },
  { cardId: cardId("07045"), cardSetCode: "piledriver", marvelcdbCodes: ["07045"], corrections: [] },
  {
    cardId: cardId("07046"),
    cardSetCode: "bulldozer",
    marvelcdbCodes: ["07046", "07047"],
    corrections: ["data decision: Bulldozer A/B, single-sided. Signature side scheme: Clear the Road (07048)."],
  },
  { cardId: cardId("07048"), cardSetCode: "bulldozer", marvelcdbCodes: ["07048"], corrections: [] },
  { cardId: cardId("07049"), cardSetCode: "bulldozer", marvelcdbCodes: ["07049"], corrections: [] },
  {
    cardId: cardId("07050"),
    cardSetCode: "bulldozer",
    marvelcdbCodes: ["07050"],
    corrections: [
      "07050: Same missing possessive as 07036, on the Bulldozer copy of Held Hostage. [evidence: raw (07005/07021 read \"the active villain's side scheme\"); phase7 §1.12]",
    ],
  },
  { cardId: cardId("07051"), cardSetCode: "bulldozer", marvelcdbCodes: ["07051"], corrections: [] },
  {
    cardId: cardId("07052"),
    cardSetCode: "bulldozer",
    marvelcdbCodes: ["07052"],
    corrections: [
      "data decision: Guard minion (Corrupt Prison Guard, Bulldozer deck copy). Printed SCH is 0, same as 07008.",
    ],
  },
  { cardId: cardId("07053"), cardSetCode: "bulldozer", marvelcdbCodes: ["07053"], corrections: [] },
  { cardId: cardId("07054"), cardSetCode: "bulldozer", marvelcdbCodes: ["07054"], corrections: [] },
  { cardId: cardId("07055"), cardSetCode: "bulldozer", marvelcdbCodes: ["07055"], corrections: [] },
  { cardId: cardId("07056"), cardSetCode: "bulldozer", marvelcdbCodes: ["07056"], corrections: [] },
  { cardId: cardId("07057"), cardSetCode: "bulldozer", marvelcdbCodes: ["07057"], corrections: [] },
  { cardId: cardId("07058"), cardSetCode: "bulldozer", marvelcdbCodes: ["07058"], corrections: [] },
  { cardId: cardId("07059"), cardSetCode: "bulldozer", marvelcdbCodes: ["07059"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const TWC_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [
  {
    marvelcdbCode: "07001",
    reason: "MarvelCDB aggregate record duplicating main scheme stage 07001a/07001b.",
  },
];
