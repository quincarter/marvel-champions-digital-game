// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mts (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mts.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mts.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mts [--offline]

import { cardId, encounterSetId, setCode, trait } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const MTS_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("armies_of_titan"), name: "Armies of Titan", packCodes: [setCode("mts")] },
  { id: encounterSetId("black_order"), name: "Black Order", packCodes: [setCode("mts")] },
  {
    id: encounterSetId("children_of_thanos"),
    name: "Children of Thanos",
    packCodes: [setCode("mts")],
  },
  { id: encounterSetId("ebony_maw"), name: "Ebony Maw", packCodes: [setCode("mts")] },
  { id: encounterSetId("enchantress"), name: "Enchantress", packCodes: [setCode("mts")] },
  { id: encounterSetId("frost_giants"), name: "Frost Giants", packCodes: [setCode("mts")] },
  { id: encounterSetId("hela"), name: "Hela", packCodes: [setCode("mts")] },
  {
    id: encounterSetId("infinity_gauntlet"),
    name: "Infinity Gauntlet",
    packCodes: [setCode("mts")],
    separateDecks: [
      {
        name: "Infinity Stone",
        contents: { encounterSetIds: [encounterSetId("infinity_gauntlet")], trait: trait("INFINITY STONE") },
        discardPile: "own",
        whenEmpty: "reshuffleDiscardWithoutPenalty",
      },
    ],
    singleVillainOnly: true,
  },
  { id: encounterSetId("legions_of_hel"), name: "Legions of Hel", packCodes: [setCode("mts")] },
  { id: encounterSetId("loki"), name: "Loki", packCodes: [setCode("mts")] },
  {
    id: encounterSetId("mts_campaign"),
    name: "The Mad Titan's Shadow Campaign",
    packCodes: [setCode("mts")],
    campaignSpecific: true,
  },
  {
    id: encounterSetId("spectrum_nemesis"),
    name: "Spectrum Nemesis",
    packCodes: [setCode("mts")],
    nemesisOfIdentityId: cardId("21001a"),
  },
  { id: encounterSetId("thanos"), name: "Thanos", packCodes: [setCode("mts")] },
  { id: encounterSetId("tower_defense"), name: "Tower Defense", packCodes: [setCode("mts")] },
  {
    id: encounterSetId("warlock_nemesis"),
    name: "Adam Warlock Nemesis",
    packCodes: [setCode("mts")],
    nemesisOfIdentityId: cardId("21031a"),
  },
];
