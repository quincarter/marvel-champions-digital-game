// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/synthezoid (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/synthezoid.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/synthezoid.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack synthezoid [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** registration-she-hulk: MC57 p. 6: "Leader Deck: She-Hulk (I), She-Hulk (II) ... (III), (IV) for expert mode. Main Scheme Deck: Enforce the Law (1B), Mighty Avengers (2B). Encounter Deck: She-Hulk, S.H.I.E.L.D. Ops, Thunderbolts, Taskmaster, Deadly Duo, and Standard encounter sets." (spec section 2.1, read from the rulebook). Each set can be removed and added to other scenarios of the same side (MC57 p. 6; MC56 p. 4).; resistance-vision: MC57 p. 7: "Leader Deck: Vision (I), Vision (II) ... (III), (IV) for expert mode. Main Scheme Deck: Protect Secret Identities (1B), Expose Overreach (2B). Encounter Deck: Vision, Young Avengers, Scarlet Twins, Moon Knight, Royal Guard, and Standard encounter sets." (spec section 2.2, read from the rulebook). */
export const SYNTHEZOID_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("registration-she-hulk"),
    name: "Registration: She-Hulk",
    packCode: setCode("synthezoid"),
    villainCardId: cardId("57001"),
    mainSchemeCardId: cardId("57005a"),
    encounterSetIds: [encounterSetId("she_hulk_leader")],
    recommendedModularSetIds: [
      encounterSetId("shield_ops"),
      encounterSetId("thunderbolts_modular"),
      encounterSetId("taskmaster_modular"),
      encounterSetId("deadly_duo"),
    ],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [3, 4] },
    modularSetCount: 4,
    modularSetCountRange: { min: 3, max: 4 },
    side: "registration",
    mainSchemeStages: { recommended: [cardId("57005b"), cardId("57006b")] },
  },
  {
    id: scenarioId("resistance-vision"),
    name: "Resistance: Vision",
    packCode: setCode("synthezoid"),
    villainCardId: cardId("57040"),
    mainSchemeCardId: cardId("57044a"),
    encounterSetIds: [encounterSetId("vision_leader")],
    recommendedModularSetIds: [
      encounterSetId("young_avengers"),
      encounterSetId("scarlet_twins"),
      encounterSetId("moon_knight_modular"),
      encounterSetId("royal_guard"),
    ],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [3, 4] },
    modularSetCount: 4,
    modularSetCountRange: { min: 3, max: 4 },
    side: "resistance",
    mainSchemeStages: { recommended: [cardId("57044b"), cardId("57045b")] },
  },
];
