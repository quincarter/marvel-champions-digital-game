// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/tt (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/tt.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/tt.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack tt [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** enchantress: Prime Real Estate 1A (55004a) Contents: "Enchantress (I) and Enchantress (II). (Enchantress (II) and Enchantress (III) instead for expert mode.) Enchantress and Standard encounter sets. One modular set (Trickster Magic)." Setup: "Set the Future of Despair side scheme aside. Attach a random Hypnotic Gaze to each identity (players cannot look at the reverse sides). Set each remaining Hypnotic Gaze aside." Insert pp. 6 to 7 (scenario 1). The Trickster Magic modular set is the one required modular set; its four linked allies are set aside at setup for any scenario using it (insert p. 2). The Expert encounter set comes from RRG 1.8 "Modes of Play" (p. 28), not from the pack (see expertSetCodes).; god-of-lies: Worlds Collide A (55028a) Contents: "Loki, God of Lies (1). God of Lies and Standard encounter sets. One modular encounter set (Trickster Magic)." Setup: "Create a separate game area for each player group. Each group follows the instructions on Mischief and Mayhem (1A)." Insert p. 10 (Single Group Mode): "first resolve the Setup ability on the Worlds Collide (A) main scheme, then resolve the Setup ability on the Mischief and Mayhem (1A) main scheme"; Loki, his hit point dial and Worlds Collide sit in a separate game area and "can only be affected by cards that refer to them by name"; "In Single Group Mode, the only group in your pod is your own group". Mischief and Mayhem 1A Setup: "Put a random Avatar of Loki villain into play. Set each other Avatar of Loki villain and the Shatter the Illusion card aside. Put each Synergy environment into play. In standard mode, set the Intense Focus attachment aside. In expert mode, attach it to the Avatar of Loki villain in play." Insert pp. 18 to 21 (rules for both modes). Single-table play only: Epic Multiplayer Mode is not built. The Expert encounter set comes from RRG 1.8 "Modes of Play" (p. 28), not from the pack. */
export const TT_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("enchantress"),
    name: "Enchantress",
    packCode: setCode("tt"),
    villainCardId: cardId("55001"),
    mainSchemeCardId: cardId("55004a"),
    encounterSetIds: [encounterSetId("enchantress_villain")],
    recommendedModularSetIds: [encounterSetId("trickster_magic")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 1,
  },
  {
    id: scenarioId("god-of-lies"),
    name: "God of Lies",
    packCode: setCode("tt"),
    villainCardId: cardId("55029a"),
    mainSchemeCardId: cardId("55033a"),
    encounterSetIds: [encounterSetId("god_of_lies")],
    recommendedModularSetIds: [encounterSetId("trickster_magic")],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    setAsideVillainCardIds: [cardId("55030a"), cardId("55031a"), cardId("55032a")],
    neutralCards: { villainCardId: cardId("55027a"), mainSchemeCardId: cardId("55028a") },
    victory: "cardAbility",
    startingVillain: "bySetup",
  },
];
