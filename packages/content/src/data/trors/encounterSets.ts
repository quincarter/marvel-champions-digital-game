// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/trors (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/trors.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/trors.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack trors [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const TRORS_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("absorbing_man"), name: "Absorbing Man", packCodes: [setCode("trors")] },
  { id: encounterSetId("crossbones"), name: "Crossbones", packCodes: [setCode("trors")] },
  {
    id: encounterSetId("expcamp"),
    name: "Expert Campaign",
    packCodes: [setCode("trors")],
    campaignSpecific: true,
  },
  { id: encounterSetId("exper_weapon"), name: "Experimental Weapons", packCodes: [setCode("trors")] },
  {
    id: encounterSetId("hawkeye_nemesis"),
    name: "Hawkeye Nemesis",
    packCodes: [setCode("trors")],
    nemesisOfIdentityId: cardId("04001a"),
  },
  { id: encounterSetId("hydra_assault"), name: "Hydra Assault", packCodes: [setCode("trors")] },
  {
    id: encounterSetId("hydra_camp"),
    name: "Hydra Campaign",
    packCodes: [setCode("trors")],
    campaignSpecific: true,
  },
  { id: encounterSetId("hydra_patrol"), name: "Hydra Patrol", packCodes: [setCode("trors")] },
  { id: encounterSetId("red_skull"), name: "Red Skull", packCodes: [setCode("trors")] },
  {
    id: encounterSetId("spider_woman_nemesis"),
    name: "Spider-Woman Nemesis",
    packCodes: [setCode("trors")],
    nemesisOfIdentityId: cardId("04031a"),
  },
  { id: encounterSetId("taskmaster"), name: "Taskmaster", packCodes: [setCode("trors")] },
  { id: encounterSetId("weap_master"), name: "Weapon Master", packCodes: [setCode("trors")] },
  { id: encounterSetId("zola"), name: "Zola", packCodes: [setCode("trors")] },
];
