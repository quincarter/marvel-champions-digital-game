// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mojo (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mojo.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mojo.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mojo [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const MOJO_PROVENANCE: readonly CardProvenance[] = [
  { cardId: cardId("39001a"), cardSetCode: "magog", marvelcdbCodes: ["39001a"], corrections: [] },
  { cardId: cardId("39001b"), cardSetCode: "magog", marvelcdbCodes: ["39001b"], corrections: [] },
  {
    cardId: cardId("39002a"),
    cardSetCode: "magog",
    marvelcdbCodes: ["39002a", "39002b"],
    corrections: [],
  },
  {
    cardId: cardId("39003a"),
    cardSetCode: "magog",
    marvelcdbCodes: ["39003a", "39003b"],
    corrections: [],
  },
  {
    cardId: cardId("39004a"),
    cardSetCode: "magog",
    marvelcdbCodes: ["39004a", "39004b"],
    corrections: [],
  },
  { cardId: cardId("39005"), cardSetCode: "magog", marvelcdbCodes: ["39005"], corrections: [] },
  { cardId: cardId("39006"), cardSetCode: "magog", marvelcdbCodes: ["39006"], corrections: [] },
  { cardId: cardId("39007"), cardSetCode: "magog", marvelcdbCodes: ["39007"], corrections: [] },
  { cardId: cardId("39008"), cardSetCode: "magog", marvelcdbCodes: ["39008"], corrections: [] },
  { cardId: cardId("39009"), cardSetCode: "magog", marvelcdbCodes: ["39009"], corrections: [] },
  { cardId: cardId("39010"), cardSetCode: "magog", marvelcdbCodes: ["39010"], corrections: [] },
  { cardId: cardId("39011"), cardSetCode: "magog", marvelcdbCodes: ["39011"], corrections: [] },
  {
    cardId: cardId("39012a"),
    cardSetCode: "spiral",
    marvelcdbCodes: ["39012a", "39013a", "39014a", "39012b", "39013b", "39014b"],
    corrections: [
      "data decision: Spiral's ESCAPED ATK prints \"★\" (scan 39012a.png), emitted as a dashed ATK (0) on all three ESCAPED stages: her own Forced Interrupt (\"When Spiral would attack, she schemes instead\") replaces every attack before the dashed-stat skip applies (docs/phase7-wave6.md §7.7). CORNERED prints ATK 1/2/3.",
    ],
  },
  {
    cardId: cardId("39015a"),
    cardSetCode: "spiral",
    marvelcdbCodes: ["39015a", "39015b"],
    corrections: [],
  },
  {
    cardId: cardId("39016"),
    cardSetCode: "spiral",
    marvelcdbCodes: ["39016"],
    corrections: [
      "39016: The Search for Spiral prints \"Forced Response\" on its first trigger; MarvelCDB sends \"Forced Interrupt\". The after-the-last-threat-is-removed wording is a response window, so this is a transcription error, not errata. [evidence: Card scan assets/card-art/bundles/cards/39016.png: \"Forced Response: After the last threat is removed from here, the player who removed that threat reveals the top card of the show deck and places 3[per_hero] threat here.\"]",
      "39016: errata RRG 1.8 — The Search for Spiral: the Hero Action's 2 damage is a cost (cost arrow added). MarvelCDB carries the current wording; the print has a period instead of the arrow. [evidence: RRG 1.8 p. 69, MojoMania errata (#16): Should read \"Hero Action: Take 2 damage → remove 3 threat from here.\" (Added cost arrow.) Scan assets/card-art/bundles/cards/39016.png prints \"Take 2 damage. Remove 3 threat from here.\"]",
    ],
  },
  { cardId: cardId("39017"), cardSetCode: "spiral", marvelcdbCodes: ["39017"], corrections: [] },
  { cardId: cardId("39018"), cardSetCode: "spiral", marvelcdbCodes: ["39018"], corrections: [] },
  { cardId: cardId("39019"), cardSetCode: "spiral", marvelcdbCodes: ["39019"], corrections: [] },
  { cardId: cardId("39020"), cardSetCode: "spiral", marvelcdbCodes: ["39020"], corrections: [] },
  { cardId: cardId("39021"), cardSetCode: "spiral", marvelcdbCodes: ["39021"], corrections: [] },
  {
    cardId: cardId("39022"),
    cardSetCode: "mojo",
    marvelcdbCodes: ["39022", "39023", "39024"],
    corrections: [],
  },
  {
    cardId: cardId("39025a"),
    cardSetCode: "mojo",
    marvelcdbCodes: ["39025a", "39025b"],
    corrections: [],
  },
  {
    cardId: cardId("39026a"),
    cardSetCode: "mojo",
    marvelcdbCodes: ["39026a", "39026b"],
    corrections: [],
  },
  { cardId: cardId("39027"), cardSetCode: "mojo", marvelcdbCodes: ["39027"], corrections: [] },
  { cardId: cardId("39028"), cardSetCode: "mojo", marvelcdbCodes: ["39028"], corrections: [] },
  { cardId: cardId("39029"), cardSetCode: "mojo", marvelcdbCodes: ["39029"], corrections: [] },
  { cardId: cardId("39030"), cardSetCode: "mojo", marvelcdbCodes: ["39030"], corrections: [] },
  { cardId: cardId("39031"), cardSetCode: "mojo", marvelcdbCodes: ["39031"], corrections: [] },
  { cardId: cardId("39032"), cardSetCode: "mojo", marvelcdbCodes: ["39032"], corrections: [] },
  { cardId: cardId("39033"), cardSetCode: "mojo", marvelcdbCodes: ["39033"], corrections: [] },
  { cardId: cardId("39034"), cardSetCode: "mojo", marvelcdbCodes: ["39034"], corrections: [] },
  { cardId: cardId("39035"), cardSetCode: "crime", marvelcdbCodes: ["39035"], corrections: [] },
  { cardId: cardId("39036"), cardSetCode: "crime", marvelcdbCodes: ["39036"], corrections: [] },
  { cardId: cardId("39037"), cardSetCode: "crime", marvelcdbCodes: ["39037"], corrections: [] },
  { cardId: cardId("39038"), cardSetCode: "crime", marvelcdbCodes: ["39038"], corrections: [] },
  { cardId: cardId("39039"), cardSetCode: "crime", marvelcdbCodes: ["39039"], corrections: [] },
  { cardId: cardId("39040"), cardSetCode: "crime", marvelcdbCodes: ["39040"], corrections: [] },
  { cardId: cardId("39041"), cardSetCode: "fantasy", marvelcdbCodes: ["39041"], corrections: [] },
  { cardId: cardId("39042"), cardSetCode: "fantasy", marvelcdbCodes: ["39042"], corrections: [] },
  { cardId: cardId("39043"), cardSetCode: "fantasy", marvelcdbCodes: ["39043"], corrections: [] },
  { cardId: cardId("39044"), cardSetCode: "fantasy", marvelcdbCodes: ["39044"], corrections: [] },
  {
    cardId: cardId("39045"),
    cardSetCode: "fantasy",
    marvelcdbCodes: ["39045"],
    corrections: [
      "39045: errata RRG 1.8 — Fetch Quest: \"for free\" became \"ignoring its resource cost\" (a card with a requirement cannot be played this way). MarvelCDB carries the current wording. [evidence: RRG 1.8 p. 69, MojoMania errata (#45): \"... and play that card, ignoring its resource cost.\" (Replaced \"for free\" with \"ignoring its resource cost\".) Scan assets/card-art/bundles/cards/39045.png prints \"play that card for free.\"]",
    ],
  },
  { cardId: cardId("39046"), cardSetCode: "fantasy", marvelcdbCodes: ["39046"], corrections: [] },
  { cardId: cardId("39047"), cardSetCode: "horror", marvelcdbCodes: ["39047"], corrections: [] },
  { cardId: cardId("39048"), cardSetCode: "horror", marvelcdbCodes: ["39048"], corrections: [] },
  { cardId: cardId("39049"), cardSetCode: "horror", marvelcdbCodes: ["39049"], corrections: [] },
  { cardId: cardId("39050"), cardSetCode: "horror", marvelcdbCodes: ["39050"], corrections: [] },
  { cardId: cardId("39051"), cardSetCode: "horror", marvelcdbCodes: ["39051"], corrections: [] },
  { cardId: cardId("39052"), cardSetCode: "horror", marvelcdbCodes: ["39052"], corrections: [] },
  { cardId: cardId("39053"), cardSetCode: "sci-fi", marvelcdbCodes: ["39053"], corrections: [] },
  {
    cardId: cardId("39054"),
    cardSetCode: "sci-fi",
    marvelcdbCodes: ["39054"],
    corrections: [
      "39054: Avalanche 9.0 prints \"deal 1 damage to that character\"; MarvelCDB sends \"this character\". [evidence: Card scan assets/card-art/bundles/cards/39054.png: \"Forced Response: After Avalanche 9.0 engages you, exhaust a character you control and deal 1 damage to that character.\"]",
    ],
  },
  { cardId: cardId("39055"), cardSetCode: "sci-fi", marvelcdbCodes: ["39055"], corrections: [] },
  { cardId: cardId("39056"), cardSetCode: "sci-fi", marvelcdbCodes: ["39056"], corrections: [] },
  { cardId: cardId("39057"), cardSetCode: "sci-fi", marvelcdbCodes: ["39057"], corrections: [] },
  { cardId: cardId("39058"), cardSetCode: "sci-fi", marvelcdbCodes: ["39058"], corrections: [] },
  { cardId: cardId("39059"), cardSetCode: "sci-fi", marvelcdbCodes: ["39059"], corrections: [] },
  { cardId: cardId("39060"), cardSetCode: "sitcom", marvelcdbCodes: ["39060"], corrections: [] },
  { cardId: cardId("39061"), cardSetCode: "sitcom", marvelcdbCodes: ["39061"], corrections: [] },
  { cardId: cardId("39062"), cardSetCode: "sitcom", marvelcdbCodes: ["39062"], corrections: [] },
  { cardId: cardId("39063"), cardSetCode: "sitcom", marvelcdbCodes: ["39063"], corrections: [] },
  { cardId: cardId("39064"), cardSetCode: "sitcom", marvelcdbCodes: ["39064"], corrections: [] },
  { cardId: cardId("39065"), cardSetCode: "sitcom", marvelcdbCodes: ["39065"], corrections: [] },
  { cardId: cardId("39066"), cardSetCode: "western", marvelcdbCodes: ["39066"], corrections: [] },
  { cardId: cardId("39067"), cardSetCode: "western", marvelcdbCodes: ["39067"], corrections: [] },
  { cardId: cardId("39068"), cardSetCode: "western", marvelcdbCodes: ["39068"], corrections: [] },
  { cardId: cardId("39069"), cardSetCode: "western", marvelcdbCodes: ["39069"], corrections: [] },
  { cardId: cardId("39070"), cardSetCode: "western", marvelcdbCodes: ["39070"], corrections: [] },
  {
    cardId: cardId("39071"),
    cardSetCode: "longshot",
    marvelcdbCodes: ["39071"],
    corrections: [
      "39071: Longshot is a When-Revealed encounter-side ally (\"Put Longshot into play under...\"), never played from hand: raw sends no `cost` at all — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap. [evidence: MarvelCDB card listing (marvelcdb.com/card/39071), \"Cost: —\". cardBack: MojoMania insert p. 2 (hallofheroeslcg.com/wp-content/uploads/2022/11/mojomania-insert.pdf): \"The Longshot ally card has an encounter card back and forms its own one-card modular encounter set\"; the scan assets/card-art/bundles/cards/39071.png is the front only.]",
    ],
  },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const MOJO_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
