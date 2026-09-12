// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/core (fetched 2026-09-12; raw cache: packages/content/raw/marvelcdb/core.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/core.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack core [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const CORE_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("black_panther_nemesis"),
    name: "Black Panther Nemesis",
    packCodes: [setCode("core")],
    nemesisOfIdentityId: cardId("01040a"),
  },
  { id: encounterSetId("bomb_scare"), name: "Bomb Scare", packCodes: [setCode("core")] },
  {
    id: encounterSetId("captain_marvel_nemesis"),
    name: "Captain Marvel Nemesis",
    packCodes: [setCode("core")],
    nemesisOfIdentityId: cardId("01010a"),
  },
  { id: encounterSetId("expert"), name: "Expert", packCodes: [setCode("core")] },
  {
    id: encounterSetId("iron_man_nemesis"),
    name: "Iron Man Nemesis",
    packCodes: [setCode("core")],
    nemesisOfIdentityId: cardId("01029a"),
  },
  { id: encounterSetId("klaw"), name: "Klaw", packCodes: [setCode("core")] },
  { id: encounterSetId("legions_of_hydra"), name: "Legions of Hydra", packCodes: [setCode("core")] },
  { id: encounterSetId("masters_of_evil"), name: "Masters of Evil", packCodes: [setCode("core")] },
  { id: encounterSetId("rhino"), name: "Rhino", packCodes: [setCode("core")] },
  {
    id: encounterSetId("she_hulk_nemesis"),
    name: "She-Hulk Nemesis",
    packCodes: [setCode("core")],
    nemesisOfIdentityId: cardId("01019a"),
  },
  {
    id: encounterSetId("spider_man_nemesis"),
    name: "Spider-Man Nemesis",
    packCodes: [setCode("core")],
    nemesisOfIdentityId: cardId("01001a"),
  },
  { id: encounterSetId("standard"), name: "Standard", packCodes: [setCode("core")] },
  {
    id: encounterSetId("the_doomsday_chair"),
    name: "The Doomsday Chair",
    packCodes: [setCode("core")],
  },
  { id: encounterSetId("ultron"), name: "Ultron", packCodes: [setCode("core")] },
  { id: encounterSetId("under_attack"), name: "Under Attack", packCodes: [setCode("core")] },
];
