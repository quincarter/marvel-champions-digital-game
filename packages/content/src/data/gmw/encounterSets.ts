// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/gmw (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/gmw.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/gmw.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack gmw [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const GMW_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("badoon_headhunter"), name: "Badoon Headhunter", packCodes: [setCode("gmw")] },
  { id: encounterSetId("band_of_badoon"), name: "Band of Badoon", packCodes: [setCode("gmw")] },
  {
    id: encounterSetId("brotherhood_of_badoon"),
    name: "Brotherhood Of Badoon",
    packCodes: [setCode("gmw")],
  },
  { id: encounterSetId("challenge"), name: "Challenge", packCodes: [setCode("gmw")] },
  { id: encounterSetId("escape_the_museum"), name: "Escape the Museum", packCodes: [setCode("gmw")] },
  {
    id: encounterSetId("galactic_artifacts"),
    name: "Galactic Artifacts",
    packCodes: [setCode("gmw")],
  },
  {
    id: encounterSetId("groot_nemesis"),
    name: "Groot Nemesis",
    packCodes: [setCode("gmw")],
    nemesisOfIdentityId: cardId("16001a"),
  },
  {
    id: encounterSetId("infiltrate_the_museum"),
    name: "Infiltrate the Museum",
    packCodes: [setCode("gmw")],
  },
  { id: encounterSetId("kree_militant"), name: "Kree Militants", packCodes: [setCode("gmw")] },
  { id: encounterSetId("menagerie_medley"), name: "Menagerie Medley", packCodes: [setCode("gmw")] },
  { id: encounterSetId("nebula"), name: "Nebula", packCodes: [setCode("gmw")] },
  { id: encounterSetId("power_stone"), name: "Power Stone", packCodes: [setCode("gmw")] },
  {
    id: encounterSetId("rocket_nemesis"),
    name: "Rocket Raccoon Nemesis",
    packCodes: [setCode("gmw")],
    nemesisOfIdentityId: cardId("16029a"),
  },
  { id: encounterSetId("ronan"), name: "Ronan the Accuser", packCodes: [setCode("gmw")] },
  { id: encounterSetId("ship_command"), name: "Ship Command", packCodes: [setCode("gmw")] },
  { id: encounterSetId("space_pirates"), name: "Space Pirates", packCodes: [setCode("gmw")] },
  {
    id: encounterSetId("the_market"),
    name: "The Market",
    packCodes: [setCode("gmw")],
    campaignSpecific: true,
  },
];
