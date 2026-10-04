// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/phoenix (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/phoenix.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/phoenix.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack phoenix [--offline]

import { cardId } from "../../schema/index.js";
import type { CardProvenance, DroppedSourceRecord } from "../types.js";

export const PHOENIX_PROVENANCE: readonly CardProvenance[] = [
  {
    cardId: cardId("34001a"),
    cardSetCode: "phoenix",
    marvelcdbCodes: ["34001a", "34001b"],
    corrections: [],
  },
  {
    cardId: cardId("34002a"),
    cardSetCode: "phoenix",
    marvelcdbCodes: ["34002a", "34002b"],
    corrections: [
      "34002a: Phoenix Force is a \"Permanent\" upgrade that enters play through Jean Grey's own hero-kit text (Setup/flip, not played from hand): raw sends no `cost` at all on either face (34002a/34002b) — the printed-dash pattern (RRG 1.8 \"Dash (Value)\", p. 15), not a data gap. [evidence: MarvelCDB card listing (marvelcdb.com/card/34002a), \"Cost: —\"]",
    ],
  },
  {
    cardId: cardId("34003"),
    cardSetCode: "phoenix",
    marvelcdbCodes: ["34003"],
    corrections: [
      "34003: MarvelCDB transcribes the second ability as \"Response\"; the card prints \"Forced Interrupt: When Cyclops leaves play, remove 2 power counters from Phoenix Force.\" (docs/phase7-wave6.md §6.1). [evidence: Card scan assets/card-art/bundles/cards/34003.png (Phoenix 2/16, Cyclops ally), read 2026-10-01.]",
    ],
  },
  { cardId: cardId("34004"), cardSetCode: "phoenix", marvelcdbCodes: ["34004"], corrections: [] },
  { cardId: cardId("34005"), cardSetCode: "phoenix", marvelcdbCodes: ["34005"], corrections: [] },
  { cardId: cardId("34006"), cardSetCode: "phoenix", marvelcdbCodes: ["34006"], corrections: [] },
  { cardId: cardId("34007"), cardSetCode: "phoenix", marvelcdbCodes: ["34007"], corrections: [] },
  { cardId: cardId("34008"), cardSetCode: "phoenix", marvelcdbCodes: ["34008"], corrections: [] },
  { cardId: cardId("34009"), cardSetCode: "phoenix", marvelcdbCodes: ["34009"], corrections: [] },
  { cardId: cardId("34010"), cardSetCode: "phoenix", marvelcdbCodes: ["34010"], corrections: [] },
  { cardId: cardId("34011"), cardSetCode: "phoenix", marvelcdbCodes: ["34011"], corrections: [] },
  { cardId: cardId("34012"), cardSetCode: "phoenix", marvelcdbCodes: ["34012"], corrections: [] },
  { cardId: cardId("34013"), cardSetCode: "phoenix", marvelcdbCodes: ["34013"], corrections: [] },
  { cardId: cardId("34014"), cardSetCode: "justice", marvelcdbCodes: ["34014"], corrections: [] },
  { cardId: cardId("34015"), cardSetCode: "justice", marvelcdbCodes: ["34015"], corrections: [] },
  {
    cardId: cardId("34016"),
    cardSetCode: "justice",
    marvelcdbCodes: ["34016"],
    corrections: [
      "34016: MarvelCDB reads \"+1 THW point\"; the card prints \"Attached ally gets +1 THW and +2 hit points.\" (docs/phase7-wave6.md §6.1). [evidence: Card scan assets/card-art/bundles/cards/34016.png (Phoenix 16/16, Mission Training), read 2026-10-01.]",
    ],
  },
  { cardId: cardId("34017"), cardSetCode: "justice", marvelcdbCodes: ["34017"], corrections: [] },
  { cardId: cardId("34018"), cardSetCode: "justice", marvelcdbCodes: ["34018"], corrections: [] },
  {
    cardId: cardId("34019"),
    cardSetCode: "justice",
    marvelcdbCodes: ["34019"],
    corrections: [],
    duplicateOfCardId: cardId("15014"),
  },
  { cardId: cardId("34020"), cardSetCode: "justice", marvelcdbCodes: ["34020"], corrections: [] },
  { cardId: cardId("34021"), cardSetCode: "basic", marvelcdbCodes: ["34021"], corrections: [] },
  { cardId: cardId("34022"), cardSetCode: "basic", marvelcdbCodes: ["34022"], corrections: [] },
  {
    cardId: cardId("34023"),
    cardSetCode: "basic",
    marvelcdbCodes: ["34023"],
    corrections: [],
    duplicateOfCardId: cardId("33023"),
  },
  {
    cardId: cardId("34024"),
    cardSetCode: "basic",
    marvelcdbCodes: ["34024"],
    corrections: [],
    duplicateOfCardId: cardId("05033"),
  },
  {
    cardId: cardId("34025"),
    cardSetCode: "basic",
    marvelcdbCodes: ["34025"],
    corrections: [],
    duplicateOfCardId: cardId("01088"),
  },
  {
    cardId: cardId("34026"),
    cardSetCode: "basic",
    marvelcdbCodes: ["34026"],
    corrections: [],
    duplicateOfCardId: cardId("01089"),
  },
  {
    cardId: cardId("34027"),
    cardSetCode: "basic",
    marvelcdbCodes: ["34027"],
    corrections: [],
    duplicateOfCardId: cardId("01090"),
  },
  {
    cardId: cardId("34028"),
    cardSetCode: "phoenix",
    marvelcdbCodes: ["34028"],
    corrections: [
      "34028: MarvelCDB's raw record for Burning Hunger has no `text` or `real_text` field at all — transcribed verbatim from the card scan. The flavour line is italic on the card, kept as the first line. [evidence: Card scan assets/card-art/bundles/cards/34028.png (Phoenix 28, Obligation), read 2026-10-01; UNLEASHED and RESTRAINED are bold-italic trait names on the scan.]",
    ],
  },
  {
    cardId: cardId("34029"),
    cardSetCode: "phoenix_nemesis",
    marvelcdbCodes: ["34029"],
    corrections: [],
  },
  {
    cardId: cardId("34030"),
    cardSetCode: "phoenix_nemesis",
    marvelcdbCodes: ["34030"],
    corrections: [],
  },
  {
    cardId: cardId("34031"),
    cardSetCode: "phoenix_nemesis",
    marvelcdbCodes: ["34031"],
    corrections: [
      "34031: MarvelCDB's raw text for Fiery Rage is only \"Peril.\", dropping the reminder text and the When Revealed — transcribed verbatim from the scan (docs/phase7-wave6.md §6.1). [evidence: Card scan assets/card-art/bundles/cards/34031.png (Phoenix Nemesis 3/5, Treachery), read 2026-10-01: \"Peril. (While you are resolving this card, other players cannot help you.) When Revealed: If Dark Phoenix is in play, she activates against you. If Dark Phoenix is not in play, place 1 threat on Consume the World and this card gains surge.\"]",
    ],
  },
  { cardId: cardId("34032"), cardSetCode: "aggression", marvelcdbCodes: ["34032"], corrections: [] },
  { cardId: cardId("34033"), cardSetCode: "protection", marvelcdbCodes: ["34033"], corrections: [] },
  { cardId: cardId("34034"), cardSetCode: "leadership", marvelcdbCodes: ["34034"], corrections: [] },
  { cardId: cardId("34035"), cardSetCode: "basic", marvelcdbCodes: ["34035"], corrections: [] },
];

/** MarvelCDB records deliberately not ingested, with the reason. */
export const PHOENIX_DROPPED_SOURCE_RECORDS: readonly DroppedSourceRecord[] = [

];
