// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mts (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mts.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mts.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mts [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** ebony-maw: Attack on Knowhere 1A (21074a): "Contents: Ebony Maw (I) and Ebony Maw (II). (Ebony Maw (II) and Ebony Maw (III) instead for expert mode.) Ebony Maw and Standard encounter sets. Two modular encounter set (Armies of Titan and Black Order)." MC21 p. 6.; tower-defense: Under Siege 1A (21098a): "Contents: Proxima Midnight I and II (stages (II) and (III) instead for expert mode). Corvus Glaive I and II (stages (II) and (III) instead for expert mode). Tower Defense and Standard sets. One modular encounter set (Armies of Titan)." "Setup: Reveal stage 2A and put it into play next to this stage so there are two main schemes and two villains in play." MC21 p. 10: "Encounter Deck: Tower Defense, Armies of Titan, and Standard sets", one deck for both villains (docs/phase7-wave4.md §1.6). Not yet playable: the engine has no shared-deck/two-main-scheme primitive (docs/phase7-wave4.md §3.2, §3.6 — not started).; thanos: The Infinity Stones 1A (21114a): "Contents: Thanos I and Thanos II (Thanos II and Thanos III for expert mode). Thanos, Infinity Gauntlet and Standard sets. Two modular sets (Black Order and Children of Thanos). See rules insert for The Infinity Gauntlet rules." MC21 p. 16. Not yet playable: the Infinity Stone deck (docs/phase7-wave4.md §3.6 — not started).; hela: Odin's Torment 1A (21138a): "Contents: Villain deck Hela A (Hela B instead for expert mode). Hela and standard sets. Two modular encounter sets (Legions of Hel and Frost Giants)." "Setup: Attach Odin to the main scheme, captive side faceup. Reveal Gnipahellir and Garm. Set Gjallerbru, Skurge, Hall of Nastrond, and Nidhogg aside, out of play. Shuffle the encounter deck." MC21 p. 20. Not yet playable: an encounter ally attached to the main scheme (docs/phase7-wave4.md §3.8 — not started).; loki: All Hail King Loki 1A (21165a): "Contents: Loki, Infinity Gauntlet, and Standard encounter sets. Two modular encounter sets (Enchantress and Frost Giants)." "Setup: Set each copy of the Loki villain aside, out of play. Put the War in Asgard side scheme into play. Shuffle the encounter deck. Reveal 1 set-aside Loki villain at random. Reveal the top card of the infinity stone deck." MC21 p. 24: "choose one Loki villain card at random, reveal it and put it into play. Set the remaining four versions of Loki aside", "Rookie Mode – One version of Loki; Standard Mode – Two versions; Expert Mode – Three versions; Heroic Mode – Four versions." 21165b's own text: "If the number of Lokis in the victory display is equal to the victory condition, the players win the game." `victory: "cardAbility"` because defeating a Loki stage only ever advances to another random Loki (21160-21164's own "Forced Interrupt: When Loki is defeated, advance to a random set-aside Loki villain"), never wins by itself. Not yet playable: the random-start/swap/victory-count primitive (docs/phase7-wave4.md §3.7 — not started). */
export const MTS_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("ebony-maw"),
    name: "Ebony Maw",
    packCode: setCode("mts"),
    villainCardId: cardId("21071"),
    mainSchemeCardId: cardId("21074a"),
    encounterSetIds: [encounterSetId("ebony_maw")],
    recommendedModularSetIds: [encounterSetId("armies_of_titan"), encounterSetId("black_order")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
  },
  {
    id: scenarioId("tower-defense"),
    name: "Tower Defense",
    packCode: setCode("mts"),
    villainCardId: cardId("21092"),
    mainSchemeCardId: cardId("21098a"),
    encounterSetIds: [encounterSetId("tower_defense")],
    recommendedModularSetIds: [encounterSetId("armies_of_titan")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    multipleVillains: {
      villains: [
        { villainCardId: cardId("21092"), encounterSetIds: [] },
        { villainCardId: cardId("21095"), encounterSetIds: [] },
      ],
      encounterDecks: "shared",
      activation: "activeVillainOnly",
      winCondition: "allVillainsDefeated",
    },
    modularSetCount: 1,
  },
  {
    id: scenarioId("thanos"),
    name: "Thanos",
    packCode: setCode("mts"),
    villainCardId: cardId("21111"),
    mainSchemeCardId: cardId("21114a"),
    encounterSetIds: [encounterSetId("thanos"), encounterSetId("infinity_gauntlet")],
    recommendedModularSetIds: [encounterSetId("black_order"), encounterSetId("children_of_thanos")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 2,
  },
  {
    id: scenarioId("hela"),
    name: "Hela",
    packCode: setCode("mts"),
    villainCardId: cardId("21136a"),
    mainSchemeCardId: cardId("21138a"),
    encounterSetIds: [encounterSetId("hela")],
    recommendedModularSetIds: [encounterSetId("legions_of_hel"), encounterSetId("frost_giants")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 2,
    expertVillains: { villainCardId: cardId("21137a"), setAsideVillainCardIds: [] },
  },
  {
    id: scenarioId("loki"),
    name: "Loki",
    packCode: setCode("mts"),
    villainCardId: cardId("21160"),
    mainSchemeCardId: cardId("21165a"),
    encounterSetIds: [encounterSetId("loki"), encounterSetId("infinity_gauntlet")],
    recommendedModularSetIds: [encounterSetId("enchantress"), encounterSetId("frost_giants")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 2,
    setAsideVillainCardIds: [cardId("21161"), cardId("21162"), cardId("21163"), cardId("21164")],
    victory: "cardAbility",
    startingVillain: "random",
    victoryCondition: { skirmish: 1, standard: 2, expert: 3, heroic: 4 },
  },
];
