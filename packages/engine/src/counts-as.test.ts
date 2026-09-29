/**
 * docs/phase7-wave5.md §3.9: a card that counts as another card type with a trait. Synthetic cards shaped like Festering
 * Mass (`sm` 27124, a side scheme: "While there are no other [Symbiote] environments in play, this card is considered a
 * [Symbiote] environment") and the readers "If a [Symbiote] environment is in play" (Lower Manhattan, 27117a) and "If
 * there are at least 2 [Symbiote] environments in play, the players lose the game" (27117b–27119b).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { cardsInPlay, matchesQuery, traitsOf, type EffectContext } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEnvironment, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn } from "./testing/wave3.js";

const SYMBIOTE = trait("SYMBIOTE");
const symbioteEnvironment: TargetQuery = { categories: ["environment"], trait: SYMBIOTE };

const FESTERING_DEFINITION: AbilityDefinition = {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "countsAs",
        target: { self: true },
        categories: ["environment"],
        traits: [SYMBIOTE],
        while: { kind: "not", of: { kind: "exists", query: { ...symbioteEnvironment, self: false } } },
      },
    ],
  },
  effects: [],
};
const FESTERING = stubAbility("festering.constant", FESTERING_DEFINITION);
const MASS = stubSideScheme({ id: "mass", startingThreat: 5, abilities: [FESTERING.ref] });
const TOWER = stubEnvironment({ id: "tower", traits: [SYMBIOTE] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(FESTERING);

function start(): GameState {
  return gameAtFirstTurn({
    cards: [MASS, TOWER, FILLER],
    deps,
    encounter: [MASS.id, TOWER.id, ...copiesOf(FILLER.id, 20)],
  });
}

const context: EffectContext = { selfInstanceId: null, controllerId: null, event: null, bindings: {}, deps };
const matching = (state: GameState, query: TargetQuery) =>
  cardsInPlay(state).filter((id) => matchesQuery(state, id, query, context));

describe("§3.9 'this card is considered a [Symbiote] environment'", () => {
  it("with no other Symbiote environment, the side scheme matches a Symbiote environment query and stays a side scheme", () => {
    const { state, id } = encounterCardInVillainArea(start(), MASS.id, 5);
    expect(matching(state, symbioteEnvironment)).toEqual([id]);
    expect(matching(state, { categories: ["sideScheme"] })).toContain(id);
    expect(traitsOf(state, id, deps)).toContain(SYMBIOTE);
  });

  it("with a printed Symbiote environment in play, it is not one: there is 1, not 2", () => {
    const withMass = encounterCardInVillainArea(start(), MASS.id, 5);
    const { state, id: tower } = encounterCardInVillainArea(withMass.state, TOWER.id);
    expect(matching(state, symbioteEnvironment)).toEqual([tower]);
    expect(traitsOf(state, withMass.id, deps)).not.toContain(SYMBIOTE);
  });

  it("a query read with printed characteristics only never sees it", () => {
    const { state } = encounterCardInVillainArea(start(), MASS.id, 5);
    expect(
      cardsInPlay(state).filter((id) => matchesQuery(state, id, symbioteEnvironment, { ...context, deps: depsOf() })),
    ).toEqual([]);
  });
});
