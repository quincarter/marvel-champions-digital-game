// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mut_gen (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mut_gen.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mut_gen.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mut_gen [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** sabretooth: MC32 p. 7: "Villain Deck: Sabretooth (I), Sabretooth (II)" ("Remove Sabretooth (I) and add Sabretooth (III) for expert mode."), "Main Scheme Deck: Stalked by Sabretooth, The Injured Senator", "Encounter Deck: Sabretooth, Brotherhood, Mystique, and Standard sets." The page lets the Brotherhood and Mystique sets be removed or moved to other scenarios, so both are modular (modularSetCount 2: the printed deck uses both; docs/phase7-wave6.md §2.2). Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).; project-wideawake: MC32 p. 9: "Villain Deck: Sentinel (I), Sentinel (II)" (expert: Sentinel (III) for (I)), "Main Scheme Deck: Night of the Sentinels", "Encounter Deck: Project Wideawake, Sentinels, Zero Tolerance, and Standard sets." Zero Tolerance is required ("it is required when playing Project Wideawake"), so it is an additional set; Sentinels may be removed or moved, so it is modular. Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).; master-mold: MC32 p. 12: "Villain Deck: Master Mold (I), Master Mold (II)" (expert: Master Mold (III) for (I)), "Main Scheme Deck: The Sentinel Factory, Master Mold's Agenda", "Encounter Deck: Master Mold, Sentinels, Zero Tolerance, and Standard sets." Sentinels is required ("it is required when playing Master Mold"), so it is an additional set; Zero Tolerance may be removed or moved, so it is modular. 1A Setup puts Magneto (172B) into play from the campaign set, hence setAsideCardCodes (docs/phase7-wave6.md §1.8). Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).; mansion-attack: MC32 p. 15: "Villain Deck: Avalanche (A), Blob (A), Pyro (A), Toad (A)" ("Replace each villain (A) with its villain (B) side for expert mode."), "Main Scheme Deck: The Brotherhood Strikes!, Attack on Xavier's (x4)", "Encounter Deck: Mansion Attack, Brotherhood, Mystique, and Standard sets." Brotherhood is required ("it is required when playing Mansion Attack"), Mystique may be removed or moved. "Multiple Villains": Skirmish defeat 1, Standard 2, Expert 3, Heroic 4; one villain in play at a time, order randomized. The main scheme is the single five-stage card 32125a (docs/phase7-wave6.md §1.5). Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28).; magneto: MC32 p. 18: "Villain Deck: Magneto (I), Magneto (II)" ("Remove Magneto (I) and add Magneto (III) for expert mode."), "Main Scheme Deck: Asteroid M, Factory Online, The Rule of Magnus", "Encounter Deck: Magneto, Acolytes, and Standard sets." Acolytes may be removed or moved, so it is modular. The two side schemes 32144 and 32145 are set up by 1A, not by the scenario record. Standard/Expert sets are Core's own, as in `sm` (MC32 prints 'The Standard set can be found in the Marvel Champions core set'; the Expert set per RRG 1.8 Expert Mode, p. 28). */
export const MUT_GEN_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("sabretooth"),
    name: "Sabretooth",
    packCode: setCode("mut_gen"),
    villainCardId: cardId("32060"),
    mainSchemeCardId: cardId("32063a"),
    encounterSetIds: [encounterSetId("sabretooth")],
    recommendedModularSetIds: [encounterSetId("brotherhood"), encounterSetId("mystique")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
  },
  {
    id: scenarioId("project-wideawake"),
    name: "Project Wideawake",
    packCode: setCode("mut_gen"),
    villainCardId: cardId("32084"),
    mainSchemeCardId: cardId("32087a"),
    encounterSetIds: [encounterSetId("project_wideawake"), encounterSetId("zero_tolerance")],
    recommendedModularSetIds: [encounterSetId("sentinels")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
  },
  {
    id: scenarioId("master-mold"),
    name: "Master Mold",
    packCode: setCode("mut_gen"),
    villainCardId: cardId("32109"),
    mainSchemeCardId: cardId("32112a"),
    encounterSetIds: [encounterSetId("master_mold"), encounterSetId("sentinels")],
    recommendedModularSetIds: [encounterSetId("zero_tolerance")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
    setAsideCardIds: [cardId("32172b")],
  },
  {
    id: scenarioId("mansion-attack"),
    name: "Mansion Attack",
    packCode: setCode("mut_gen"),
    villainCardId: cardId("32121a"),
    mainSchemeCardId: cardId("32125a"),
    encounterSetIds: [encounterSetId("mansion_attack"), encounterSetId("brotherhood")],
    recommendedModularSetIds: [encounterSetId("mystique")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    setAsideVillainCardIds: [cardId("32122a"), cardId("32123a"), cardId("32124a")],
    expertVillains: {
      villainCardId: cardId("32121b"),
      setAsideVillainCardIds: [cardId("32122b"), cardId("32123b"), cardId("32124b")],
    },
    victory: "cardAbility",
    startingVillain: "random",
    victoryCondition: { skirmish: 1, standard: 2, expert: 3, heroic: 4 },
  },
  {
    id: scenarioId("magneto"),
    name: "Magneto",
    packCode: setCode("mut_gen"),
    villainCardId: cardId("32138"),
    mainSchemeCardId: cardId("32141a"),
    encounterSetIds: [encounterSetId("magneto_villain")],
    recommendedModularSetIds: [encounterSetId("acolytes")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
  },
];
