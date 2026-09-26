// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/hood (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/hood.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/hood.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack hood [--offline]

import { encounterSetId, setCode } from "../../schema/index.js";
import type { EncounterSet } from "../../schema/index.js";

export const HOOD_ENCOUNTER_SETS: readonly EncounterSet[] = [
  { id: encounterSetId("beasty_boys"), name: "Beasty Boys", packCodes: [setCode("hood")] },
  { id: encounterSetId("brothers_grimm"), name: "Brothers Grimm", packCodes: [setCode("hood")] },
  { id: encounterSetId("crossfire_crew"), name: "Crossfire's Crew", packCodes: [setCode("hood")] },
  {
    id: encounterSetId("expert_ii"),
    name: "Expert II",
    packCodes: [setCode("hood")],
    classification: "expert",
  },
  { id: encounterSetId("mister_hyde"), name: "Mister Hyde", packCodes: [setCode("hood")] },
  { id: encounterSetId("ransacked_armory"), name: "Ransacked Armory", packCodes: [setCode("hood")] },
  {
    id: encounterSetId("sinister_syndicate"),
    name: "Sinister Syndicate",
    packCodes: [setCode("hood")],
  },
  {
    id: encounterSetId("standard_ii"),
    name: "Standard II",
    packCodes: [setCode("hood")],
    classification: "standard",
  },
  {
    id: encounterSetId("state_of_emergency"),
    name: "State of Emergency",
    packCodes: [setCode("hood")],
  },
  { id: encounterSetId("streets_of_mayhem"), name: "Streets of Mayhem", packCodes: [setCode("hood")] },
  { id: encounterSetId("the_hood"), name: "The Hood", packCodes: [setCode("hood")] },
  { id: encounterSetId("wrecking_crew_modular"), name: "Wrecking Crew", packCodes: [setCode("hood")] },
];
