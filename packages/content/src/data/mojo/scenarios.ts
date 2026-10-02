// GENERATED FILE — do not edit by hand.
// Source: MarvelCDB public API https://marvelcdb.com/api/public/cards/mojo (fetched 2026-09-13; raw cache: packages/content/raw/marvelcdb/mojo.json).
// Hand corrections / curated data: packages/content/scripts/marvelcdb/curation/mojo.ts
// Regenerate: pnpm --filter @mc/content ingest -- --pack mojo [--offline]

import { cardId, encounterSetId, scenarioId, setCode } from "../../schema/index.js";
import type { Scenario } from "../../schema/index.js";

/** magog: MojoMania insert p. 7-8: MaGog is "one double-sided villain card" (standard / expert side); Melee in the Mojo-seum 1A Setup puts The Champion and The Challengers into play, each with its BOOING CROWD side faceup. 1B: "The players cannot win the game unless they wow the crowd", so MaGog's defeat never wins (docs/phase7-wave6.md 7.2). Encounter deck: MaGog, Standard and 1 modular set (1 random genre set recommended). Q44: any set may be chosen, defaulting to a random genre set. Standard/Expert sets are Core's own, as in `mansion-attack`.; spiral: MojoMania insert pp. 11-12: Spiral I-III (two-sided, ESCAPED / CORNERED; 39012a-39014a), main scheme Across the Mojoverse (39015); "Encounter sets (required)": Spiral, Standard, 3 genre sets. 1A Setup: "Put The Search for Spiral side scheme and 1 random SHOW environment into play. Shuffle each other SHOW environment together with the Cornered! treachery to create the show deck. ... Flip Spiral to her ESCAPED side." Q44: Spiral chooses only among the six genre sets (the show deck is not expressible yet). Standard/Expert sets are Core's own.; mojo: MojoMania insert p. 16: Mojo I-III (39022-39024), main scheme MojoMania (39025); 1A Setup: "Choose 1 modular set, plus 1[per_hero] additional modular sets, from the MojoMania scenario pack and set them aside. Put the Wheel of Genres environment into play, SPINNING side faceup." 1B's When Revealed brings in the first. Q44: Mojo chooses only among the six genre sets. Standard/Expert sets are Core's own. */
export const MOJO_SCENARIOS: readonly Scenario[] = [
  {
    id: scenarioId("magog"),
    name: "MaGog",
    packCode: setCode("mojo"),
    villainCardId: cardId("39001a"),
    mainSchemeCardId: cardId("39002a"),
    encounterSetIds: [encounterSetId("magog")],
    recommendedModularSetIds: [
      encounterSetId("crime"),
      encounterSetId("fantasy"),
      encounterSetId("horror"),
      encounterSetId("sci-fi"),
      encounterSetId("sitcom"),
      encounterSetId("western"),
    ],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 1], expert: [1, 1] },
    modularSetCount: 1,
    modularSetPool: {
      setIds: [
        encounterSetId("crime"),
        encounterSetId("fantasy"),
        encounterSetId("horror"),
        encounterSetId("sci-fi"),
        encounterSetId("sitcom"),
        encounterSetId("western"),
      ],
      restricted: false,
    },
    expertVillains: { villainCardId: cardId("39001b"), setAsideVillainCardIds: [] },
    victory: "cardAbility",
  },
  {
    id: scenarioId("spiral"),
    name: "Spiral",
    packCode: setCode("mojo"),
    villainCardId: cardId("39012a"),
    mainSchemeCardId: cardId("39015a"),
    encounterSetIds: [encounterSetId("spiral")],
    recommendedModularSetIds: [
      encounterSetId("crime"),
      encounterSetId("fantasy"),
      encounterSetId("horror"),
      encounterSetId("sci-fi"),
      encounterSetId("sitcom"),
      encounterSetId("western"),
    ],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 3,
    modularSetPool: {
      setIds: [
        encounterSetId("crime"),
        encounterSetId("fantasy"),
        encounterSetId("horror"),
        encounterSetId("sci-fi"),
        encounterSetId("sitcom"),
        encounterSetId("western"),
      ],
      restricted: true,
    },
  },
  {
    id: scenarioId("mojo"),
    name: "Mojo",
    packCode: setCode("mojo"),
    villainCardId: cardId("39022"),
    mainSchemeCardId: cardId("39025a"),
    encounterSetIds: [encounterSetId("mojo")],
    recommendedModularSetIds: [
      encounterSetId("crime"),
      encounterSetId("fantasy"),
      encounterSetId("horror"),
      encounterSetId("sci-fi"),
      encounterSetId("sitcom"),
      encounterSetId("western"),
    ],
    standardEncounterSetIds: [encounterSetId("standard")],
    expertEncounterSetIds: [encounterSetId("expert")],
    villainStages: { standard: [1, 2], expert: [2, 3] },
    modularSetCount: 0,
    setAsideModularSetCount: { base: 1, perPlayer: 1 },
    modularSetPool: {
      setIds: [
        encounterSetId("crime"),
        encounterSetId("fantasy"),
        encounterSetId("horror"),
        encounterSetId("sci-fi"),
        encounterSetId("sitcom"),
        encounterSetId("western"),
      ],
      restricted: true,
    },
  },
];
