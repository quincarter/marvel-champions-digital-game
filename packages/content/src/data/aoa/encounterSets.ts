// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/aoa (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/aoa.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/aoa.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack aoa [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const AOA_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("age_of_apocalypse"),
    name: "Age of Apocalypse",
    packCodes: [setCode("aoa")],
    campaignSpecific: true,
  },
  {
    id: encounterSetId("aoa_basic_campaign"),
    name: "Campaign",
    packCodes: [setCode("aoa")],
    campaignSpecific: true,
  },
  {
    id: encounterSetId("aoa_campaign"),
    name: "Campaign",
    packCodes: [setCode("aoa")],
    campaignSpecific: true,
  },
  {
    id: encounterSetId("aoa_mission"),
    name: "Mission",
    packCodes: [setCode("aoa")],
    campaignSpecific: true,
  },
  { id: encounterSetId("apocalypse"), name: "Apocalypse", packCodes: [setCode("aoa")] },
  {
    id: encounterSetId("bishop_nemesis"),
    name: "Bishop Nemesis",
    packCodes: [setCode("aoa")],
    nemesisOfIdentityId: cardId("45001a"),
  },
  { id: encounterSetId("blue_moon"), name: "Blue Moon", packCodes: [setCode("aoa")] },
  { id: encounterSetId("celestial_tech"), name: "Celestial Tech", packCodes: [setCode("aoa")] },
  { id: encounterSetId("clan_akkaba"), name: "Clan Akkaba", packCodes: [setCode("aoa")] },
  { id: encounterSetId("dark_beast"), name: "Dark Beast", packCodes: [setCode("aoa")] },
  { id: encounterSetId("dark_riders"), name: "Dark Riders", packCodes: [setCode("aoa")] },
  {
    id: encounterSetId("dystopian_nightmare"),
    name: "Dystopian Nightmare",
    packCodes: [setCode("aoa")],
  },
  { id: encounterSetId("en_sabah_nur"), name: "En Sabah Nur", packCodes: [setCode("aoa")] },
  { id: encounterSetId("four_horsemen"), name: "Four Horsemen", packCodes: [setCode("aoa")] },
  { id: encounterSetId("genosha"), name: "Genosha", packCodes: [setCode("aoa")] },
  { id: encounterSetId("hounds"), name: "Hounds", packCodes: [setCode("aoa")] },
  { id: encounterSetId("infinites"), name: "Infinites", packCodes: [setCode("aoa")] },
  {
    id: encounterSetId("magik_nemesis"),
    name: "Magik Nemesis",
    packCodes: [setCode("aoa")],
    nemesisOfIdentityId: cardId("45030a"),
  },
  {
    id: encounterSetId("overseer"),
    name: "Overseer",
    packCodes: [setCode("aoa")],
    campaignSpecific: true,
  },
  { id: encounterSetId("prelates"), name: "Prelates", packCodes: [setCode("aoa")] },
  { id: encounterSetId("savage_land"), name: "Savage Land", packCodes: [setCode("aoa")] },
  { id: encounterSetId("standard_iii"), name: "Standard III", packCodes: [setCode("aoa")] },
  { id: encounterSetId("unus"), name: "Unus", packCodes: [setCode("aoa")] },
];
