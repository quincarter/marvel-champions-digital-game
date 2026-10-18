// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/fne (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/fne.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/fne.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack fne [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const FNE_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("art_museum_heist"), name: "Art Museum Heist", packCodes: [setCode("fne")] },
  { id: encounterSetId("bullseye"), name: "Bullseye", packCodes: [setCode("fne")] },
  { id: encounterSetId("cops"), name: "Cops", packCodes: [setCode("fne")] },
  {
    id: encounterSetId("daredevil_nemesis"),
    name: "Daredevil Nemesis",
    packCodes: [setCode("fne")],
    nemesisOfIdentityId: cardId("60001a"),
  },
  { id: encounterSetId("disasters"), name: "Disasters", packCodes: [setCode("fne")] },
  { id: encounterSetId("drive"), name: "Drive", packCodes: [setCode("fne")] },
  {
    id: encounterSetId("echo_nemesis"),
    name: "Echo Nemesis",
    packCodes: [setCode("fne")],
    nemesisOfIdentityId: cardId("60037a"),
  },
  { id: encounterSetId("electro"), name: "Electro", packCodes: [setCode("fne")] },
  {
    id: encounterSetId("fne_campaign"),
    name: "Campaign",
    packCodes: [setCode("fne")],
    campaignSpecific: true,
  },
  { id: encounterSetId("hammerhead"), name: "Hammerhead", packCodes: [setCode("fne")] },
  { id: encounterSetId("kingpin"), name: "Kingpin", packCodes: [setCode("fne")] },
  { id: encounterSetId("protection_racket"), name: "Protection Racket", packCodes: [setCode("fne")] },
  { id: encounterSetId("purple_man"), name: "Purple Man", packCodes: [setCode("fne")] },
  { id: encounterSetId("stop_the_presses"), name: "Stop the Presses!", packCodes: [setCode("fne")] },
  { id: encounterSetId("the_getaway"), name: "The Getaway", packCodes: [setCode("fne")] },
  { id: encounterSetId("the_owl"), name: "The Owl", packCodes: [setCode("fne")] },
  { id: encounterSetId("the_raft_breakout"), name: "The Raft Breakout", packCodes: [setCode("fne")] },
  { id: encounterSetId("tombstone"), name: "Tombstone", packCodes: [setCode("fne")] },
  { id: encounterSetId("tracksuit_mafia"), name: "Tracksuit Mafia", packCodes: [setCode("fne")] },
  { id: encounterSetId("typhoid_mary"), name: "Typhoid Mary", packCodes: [setCode("fne")] },
];
