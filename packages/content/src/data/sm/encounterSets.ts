// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/sm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/sm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/sm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack sm [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const SM_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("bad_publicity"),
    name: "Bad Publicity",
    packCodes: [setCode("sm")],
    campaignSpecific: true,
  },
  { id: encounterSetId("city_in_chaos"), name: "City in Chaos", packCodes: [setCode("sm")] },
  {
    id: encounterSetId("community_service"),
    name: "Community Service",
    packCodes: [setCode("sm")],
    campaignSpecific: true,
  },
  { id: encounterSetId("down_to_earth"), name: "Down to Earth", packCodes: [setCode("sm")] },
  {
    id: encounterSetId("ghost_spider_nemesis"),
    name: "Ghost-Spider Nemesis",
    packCodes: [setCode("sm")],
    nemesisOfIdentityId: cardId("27001a"),
  },
  { id: encounterSetId("goblin_gear"), name: "Goblin Gear", packCodes: [setCode("sm")] },
  { id: encounterSetId("guerrilla_tactics"), name: "Guerrilla Tactics", packCodes: [setCode("sm")] },
  { id: encounterSetId("mysterio"), name: "Mysterio", packCodes: [setCode("sm")] },
  { id: encounterSetId("osborn_tech"), name: "Osborn Tech", packCodes: [setCode("sm")] },
  { id: encounterSetId("personal_nightmare"), name: "Personal Nightmare", packCodes: [setCode("sm")] },
  { id: encounterSetId("sandman"), name: "Sandman", packCodes: [setCode("sm")] },
  {
    id: encounterSetId("shield_tech"),
    name: "Shield Tech",
    packCodes: [setCode("sm")],
    campaignSpecific: true,
  },
  { id: encounterSetId("sinister_assault"), name: "Sinister Assault", packCodes: [setCode("sm")] },
  { id: encounterSetId("sinister_six"), name: "The Sinister Six", packCodes: [setCode("sm")] },
  {
    id: encounterSetId("snitches_get_stitches"),
    name: "Snitches get Stitches",
    packCodes: [setCode("sm")],
    campaignSpecific: true,
  },
  {
    id: encounterSetId("spider_man_morales_nemesis"),
    name: "Spider-Man - Morales Nemesis",
    packCodes: [setCode("sm")],
    nemesisOfIdentityId: cardId("27030a"),
  },
  { id: encounterSetId("symbiotic_strength"), name: "Symbiotic Strength", packCodes: [setCode("sm")] },
  { id: encounterSetId("venom"), name: "Venom", packCodes: [setCode("sm")] },
  { id: encounterSetId("venom_goblin"), name: "Venom Goblin", packCodes: [setCode("sm")] },
  {
    id: encounterSetId("whispers_of_paranoia"),
    name: "Whispers of Paranoia",
    packCodes: [setCode("sm")],
  },
];
