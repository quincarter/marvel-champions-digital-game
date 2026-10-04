// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/next_evol (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/next_evol.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/next_evol.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack next_evol [--offline]

import { cardId, encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const NEXT_EVOL_ENCOUNTER_SETS: readonly EncounterSet[] = [
  {
    id: encounterSetId("black_tom_cassidy"),
    name: "Black Tom Cassidy",
    packCodes: [setCode("next_evol")],
  },
  {
    id: encounterSetId("cable_nemesis"),
    name: "Cable Nemesis",
    packCodes: [setCode("next_evol")],
    nemesisOfIdentityId: cardId("40001a"),
  },
  {
    id: encounterSetId("domino_nemesis"),
    name: "Domino Nemesis",
    packCodes: [setCode("next_evol")],
    nemesisOfIdentityId: cardId("40037a"),
  },
  {
    id: encounterSetId("extreme_measures"),
    name: "Extreme Measures",
    packCodes: [setCode("next_evol")],
  },
  { id: encounterSetId("flight"), name: "Flight", packCodes: [setCode("next_evol")] },
  { id: encounterSetId("hope_summers"), name: "Hope Summers", packCodes: [setCode("next_evol")] },
  { id: encounterSetId("juggernaut"), name: "Juggernaut", packCodes: [setCode("next_evol")] },
  { id: encounterSetId("marauders"), name: "Marauders", packCodes: [setCode("next_evol")] },
  { id: encounterSetId("military_grade"), name: "Military Grade", packCodes: [setCode("next_evol")] },
  {
    id: encounterSetId("mister_sinister"),
    name: "Mister Sinister",
    packCodes: [setCode("next_evol")],
  },
  { id: encounterSetId("morlock_siege"), name: "Morlock Siege", packCodes: [setCode("next_evol")] },
  {
    id: encounterSetId("mutant_insurrection"),
    name: "Mutant Insurrection",
    packCodes: [setCode("next_evol")],
  },
  { id: encounterSetId("mutant_slayers"), name: "Mutant Slayers", packCodes: [setCode("next_evol")] },
  { id: encounterSetId("nasty_boys"), name: "Nasty Boys", packCodes: [setCode("next_evol")] },
  {
    id: encounterSetId("next_evol_campaign"),
    name: "Next Evolution Campaign",
    packCodes: [setCode("next_evol")],
    campaignSpecific: true,
  },
  { id: encounterSetId("on_the_run"), name: "On the Run", packCodes: [setCode("next_evol")] },
  { id: encounterSetId("stryfe"), name: "Stryfe", packCodes: [setCode("next_evol")] },
  { id: encounterSetId("super_strength"), name: "Super Strength", packCodes: [setCode("next_evol")] },
  { id: encounterSetId("telepathy"), name: "Telepathy", packCodes: [setCode("next_evol")] },
];
