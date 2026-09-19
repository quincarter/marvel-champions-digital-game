// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/trors (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/trors.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/trors.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack trors [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** crossbones: Red Skull rulebook (spoiler edition), p.5, "Crossbones"; 1A Contents text (raw 04061a), errata #61A; docs/phase7-wave2.md §1.8, §2.2; absorbing-man: Red Skull rulebook (spoiler edition), p.7, "Absorbing Man"; 1A Contents text (raw 04079a); docs/phase7-wave2.md §2.2; taskmaster: Red Skull rulebook (spoiler edition), p.10, "Taskmaster"; 1A Contents text (raw 04096a); docs/phase7-wave2.md §2.2; zola: Red Skull rulebook (spoiler edition), p.13, "Zola"; 1A Contents text (raw 04112a); docs/phase7-wave2.md §2.2; red-skull: Red Skull rulebook (spoiler edition), p.15, "Red Skull"; 1A Contents text (raw 04128a); errata #128A (RRG 1.8 p.66); docs/phase7-wave2.md §1.8, §2.2 */
export const TRORS_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("crossbones"),
    name: "Crossbones",
    packCode: setCode("trors"),
    villainCardId: cardId("04058"),
    mainSchemeCardId: cardId("04061a"),
    encounterSetIds: [encounterSetId("crossbones"), encounterSetId("exper_weapon")],
    recommendedModularSetIds: [encounterSetId("hydra_assault"), encounterSetId("weap_master"), encounterSetId("legions_of_hydra")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 3,
    separateDecks: [
      {
        name: "Experimental Weapons",
        contents: { encounterSetIds: [encounterSetId("exper_weapon")] },
        discardPile: "encounter",
        whenEmpty: "remainsEmpty",
      },
    ],
  },
  {
    id: scenarioId("absorbing-man"),
    name: "Absorbing Man",
    packCode: setCode("trors"),
    villainCardId: cardId("04076"),
    mainSchemeCardId: cardId("04079a"),
    encounterSetIds: [encounterSetId("absorbing_man")],
    recommendedModularSetIds: [encounterSetId("hydra_patrol")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("taskmaster"),
    name: "Taskmaster",
    packCode: setCode("trors"),
    villainCardId: cardId("04093"),
    mainSchemeCardId: cardId("04096a"),
    encounterSetIds: [encounterSetId("taskmaster"), encounterSetId("hydra_patrol")],
    recommendedModularSetIds: [encounterSetId("weap_master")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("zola"),
    name: "Zola",
    packCode: setCode("trors"),
    villainCardId: cardId("04109"),
    mainSchemeCardId: cardId("04112a"),
    encounterSetIds: [encounterSetId("zola")],
    recommendedModularSetIds: [encounterSetId("under_attack")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
  },
  {
    id: scenarioId("red-skull"),
    name: "Red Skull",
    packCode: setCode("trors"),
    villainCardId: cardId("04125"),
    mainSchemeCardId: cardId("04128a"),
    encounterSetIds: [encounterSetId("red_skull")],
    recommendedModularSetIds: [encounterSetId("hydra_assault"), encounterSetId("hydra_patrol")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
    separateDecks: [
      {
        name: "side-scheme deck",
        contents: { cardType: "side_scheme" },
        discardPile: "own",
        whenEmpty: "reshuffleDiscardWithoutPenalty",
      },
    ],
  },
];
