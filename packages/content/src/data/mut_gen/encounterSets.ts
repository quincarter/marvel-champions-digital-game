// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mut_gen (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mut_gen.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mut_gen.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mut_gen [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const MUT_GEN_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("acolytes"), name: "Acolytes", packCodes: [setCode("mut_gen")] },
  {
    id: encounterSetId("brawler"),
    name: "Brawler",
    packCodes: [setCode("mut_gen")],
    campaignSpecific: true,
  },
  { id: encounterSetId("brotherhood"), name: "Brotherhood", packCodes: [setCode("mut_gen")] },
  {
    id: encounterSetId("colossus_nemesis"),
    name: "Colossus Nemesis",
    packCodes: [setCode("mut_gen")],
    nemesisOfIdentityId: cardId("32001a"),
  },
  {
    id: encounterSetId("commander"),
    name: "Commander",
    packCodes: [setCode("mut_gen")],
    campaignSpecific: true,
  },
  {
    id: encounterSetId("defender"),
    name: "Defender",
    packCodes: [setCode("mut_gen")],
    campaignSpecific: true,
  },
  { id: encounterSetId("future_past"), name: "Future Past", packCodes: [setCode("mut_gen")] },
  { id: encounterSetId("magneto_villain"), name: "Magneto", packCodes: [setCode("mut_gen")] },
  { id: encounterSetId("mansion_attack"), name: "Mansion Attack", packCodes: [setCode("mut_gen")] },
  { id: encounterSetId("master_mold"), name: "Master Mold", packCodes: [setCode("mut_gen")] },
  {
    id: encounterSetId("mut_gen_campaign"),
    name: "Mutant Genesis Campaign",
    packCodes: [setCode("mut_gen")],
    campaignSpecific: true,
  },
  { id: encounterSetId("mystique"), name: "Mystique", packCodes: [setCode("mut_gen")] },
  {
    id: encounterSetId("peacekeeper"),
    name: "Peacekeeper",
    packCodes: [setCode("mut_gen")],
    campaignSpecific: true,
  },
  {
    id: encounterSetId("project_wideawake"),
    name: "Project Wideawake",
    packCodes: [setCode("mut_gen")],
  },
  { id: encounterSetId("sabretooth"), name: "Sabretooth", packCodes: [setCode("mut_gen")] },
  { id: encounterSetId("sentinels"), name: "Sentinels", packCodes: [setCode("mut_gen")] },
  {
    id: encounterSetId("shadowcat_nemesis"),
    name: "Shadowcat Nemesis",
    packCodes: [setCode("mut_gen")],
    nemesisOfIdentityId: cardId("32030a"),
  },
  { id: encounterSetId("zero_tolerance"), name: "Zero Tolerance", packCodes: [setCode("mut_gen")] },
];
