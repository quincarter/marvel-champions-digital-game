// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/sm (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/sm.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/sm.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack sm [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** sandman: MC27 p. 9: "Villain Deck: Sandman (I), Sandman (II)" ("Remove Sandman (I) and add Sandman (III) for expert mode."), "Main Scheme Deck: Hapless Pedestrians (1A/1B)", "Encounter Deck: Sandman, City in Chaos, Down to Earth, and Standard encounter sets." — this box has no literal "standard"/"expert" MarvelCDB set of its own (checked: no such `card_set_code` anywhere in the raw pack), so both stay empty.; venom: MC27 p. 11: "Villain Deck: Venom (I), Venom (II)" ("Remove Venom (I) and add Venom (III) for expert mode."), "Main Scheme Deck: \"Leave Us Alone!\" (1A/1B)", "Encounter Deck: Venom, Down to Earth, Symbiotic Strength, and Standard encounter sets." Not yet fully playable standalone: the boost-cards-on-an-identity mechanic (docs/phase7-wave5.md §3.6 — open).; mysterio: MC27 p. 13: "Villain Deck: Mysterio (I), Mysterio (II)" ("Remove Mysterio (I) and add Mysterio (III) for expert mode."), "Main Scheme Deck: Maze of Mirrors (1A/1B), Edge of Reality (2A/2B)", "Encounter Deck: Mysterio, Personal Nightmare, Whispers of Paranoia, and Standard encounter sets." Not yet fully playable standalone: encounter cards living in a player's deck/hand/discard pile (docs/phase7-wave5.md §3.5 — open).; sinister-six: MC27 p. 15: "Villains: Doctor Octopus (I), Electro (I), Hobgoblin (I), Kraven the Hunter (I), Scorpion (I), Vulture (I)", "Main Scheme Deck: Sinister Synchronization (1A/1B), Sinister Beatdown (2A/2B)", "Encounter Deck: The Sinister Six, Guerrilla Tactics, and Standard encounter sets." — no modular set is listed for this scenario. Sinister Synchronization 1A's own Setup ("Choose X villains at random ... Put those villains into play ... and set the other villains aside") is `atSetup: "setAside"`; the win is Light at the End's own card ability, not defeating every villain (docs/phase7-wave5.md §1.5). Not yet playable: villains that enter/leave play and an interruptible enemy activation (docs/phase7-wave5.md §3.1, §3.2 — open).; venom-goblin: MC27 p. 17: "Villain Deck: Venom Goblin (I), Venom Goblin (II)" ("Remove Venom Goblin (I) and add Venom Goblin (III) for expert mode."), "Main Scheme Deck: Skies Over New York (A), Lower Manhattan (B), Midtown Manhattan (C), Upper Manhattan (D)", "Encounter Deck: Venom Goblin, Symbiotic Strength, Goblin Gear, and Standard encounter sets." Not yet playable: the focused/glider main scheme mechanism (docs/phase7-wave5.md §3.3, §3.4, §3.9 — open). */
export const SM_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("sandman"),
    name: "Sandman",
    packCode: setCode("sm"),
    villainCardId: cardId("27061"),
    mainSchemeCardId: cardId("27064a"),
    encounterSetIds: [encounterSetId("sandman"), encounterSetId("city_in_chaos")],
    recommendedModularSetIds: [encounterSetId("down_to_earth")],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
  },
  {
    id: scenarioId("venom"),
    name: "Venom",
    packCode: setCode("sm"),
    villainCardId: cardId("27073"),
    mainSchemeCardId: cardId("27076a"),
    encounterSetIds: [encounterSetId("venom"), encounterSetId("symbiotic_strength")],
    recommendedModularSetIds: [encounterSetId("down_to_earth")],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
  },
  {
    id: scenarioId("mysterio"),
    name: "Mysterio",
    packCode: setCode("sm"),
    villainCardId: cardId("27084"),
    mainSchemeCardId: cardId("27087a"),
    encounterSetIds: [encounterSetId("mysterio"), encounterSetId("personal_nightmare")],
    recommendedModularSetIds: [encounterSetId("whispers_of_paranoia")],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
  },
  {
    id: scenarioId("sinister-six"),
    name: "The Sinister Six",
    packCode: setCode("sm"),
    villainCardId: cardId("27094"),
    mainSchemeCardId: cardId("27100a"),
    encounterSetIds: [encounterSetId("sinister_six"), encounterSetId("guerrilla_tactics")],
    recommendedModularSetIds: [],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    multipleVillains: {
      villains: [
        { villainCardId: cardId("27094"), encounterSetIds: [] },
        { villainCardId: cardId("27095"), encounterSetIds: [] },
        { villainCardId: cardId("27096"), encounterSetIds: [] },
        { villainCardId: cardId("27097"), encounterSetIds: [] },
        { villainCardId: cardId("27098"), encounterSetIds: [] },
        { villainCardId: cardId("27099"), encounterSetIds: [] },
      ],
      encounterDecks: "shared",
      activation: "activeVillainOnly",
      winCondition: "cardAbility",
      atSetup: "setAside",
    },
    modularSetCount: 0,
  },
  {
    id: scenarioId("venom-goblin"),
    name: "Venom Goblin",
    packCode: setCode("sm"),
    villainCardId: cardId("27113"),
    mainSchemeCardId: cardId("27116a"),
    encounterSetIds: [encounterSetId("venom_goblin"), encounterSetId("symbiotic_strength")],
    recommendedModularSetIds: [encounterSetId("goblin_gear")],
    standardEncounterSetIds: [],
    expertEncounterSetIds: [],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
  },
];
