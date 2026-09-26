/**
 * docs/phase7-wave5.md §3.21: an additional cost to thwart a scheme. Synthetic side schemes shaped like Giant Monster
 * Attack (`spdr`: "As an additional cost to thwart this scheme, you must spend a [energy] resource") and Cat in a Tree
 * (`spiderham`: "As an additional cost to thwart this scheme, take 2 indirect damage").
 *
 * Source: RRG 1.8 "Cost" (p. 13).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubResource, stubSideScheme } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const cost = (id: string, extra: { resources?: { energy: number }; indirectDamage?: number }) => {
  const definition: AbilityDefinition = {
    trigger: { kind: "constant", rules: [{ kind: "additionalThwartCost", scheme: { self: true }, ...extra }] },
    effects: [],
  };
  return stubAbility(id, definition);
};
const MONSTER_COST = cost("monster.constant", { resources: { energy: 1 } });
const CAT_COST = cost("cat.constant", { indirectDamage: 2 });
const MONSTER = stubSideScheme({ id: "monster", startingThreat: 6, abilities: [MONSTER_COST.ref] });
const CAT = stubSideScheme({ id: "cat", startingThreat: 6, abilities: [CAT_COST.ref] });
const SPARK = stubResource({ id: "spark", icons: 0, produces: { energy: 1 } });

const deps: EngineDeps = depsOf(MONSTER_COST, CAT_COST);

function start(scheme: typeof MONSTER): { readonly state: GameState; readonly scheme: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [MONSTER, CAT, SPARK],
    deps,
    encounter: [MONSTER.id, CAT.id],
    deck: copiesOf(SPARK.id, 2),
  });
  const hero = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const placed = encounterCardInVillainArea(hero, scheme.id, 6);
  return { state: placed.state, scheme: placed.id };
}

function thwart(state: GameState, scheme: InstanceId, pick: (s: GameState) => readonly string[] = defaultPick) {
  const hero = mustPlayer(state, P1).identity.instanceId;
  return driveSession(
    startSession(state),
    deps,
    [{ type: "basicThwart", playerId: P1, thwarterInstanceId: hero, schemeInstanceId: scheme }],
    pick,
  );
}

/** Pays a `spendResources` prompt with every option offered; anything else as `defaultPick`. */
const payAll = (s: GameState): readonly string[] => {
  const choice = s.pendingChoice;
  if (choice?.prompt.kind === "spendResources") return choice.options.map((o) => o.optionId);
  return defaultPick(s);
};

describe("§3.21 'As an additional cost to thwart this scheme, you must spend a [energy] resource'", () => {
  it("paid, the thwart removes threat; replay deep-equal", () => {
    const { state, scheme } = start(MONSTER);
    const withSpark = giveCard(state, P1, SPARK.id).state;
    const { session, events } = thwart(withSpark, scheme, payAll);
    expect(events.some((e) => e.type === "thwartCostAsked")).toBe(true);
    expect(mustInstance(session.state, scheme).threat).toBe(4);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("declined, the thwart is cancelled and removes nothing", () => {
    const { state, scheme } = start(MONSTER);
    const withSpark = giveCard(state, P1, SPARK.id).state;
    const { session } = thwart(withSpark, scheme);
    expect(mustInstance(session.state, scheme).threat).toBe(6);
  });
});

describe("§3.21 'As an additional cost to thwart this scheme, take 2 indirect damage'", () => {
  it("the thwarting player takes it, then the thwart removes threat", () => {
    const { state, scheme } = start(CAT);
    const hero = mustPlayer(state, P1).identity.instanceId;
    const { session } = thwart(state, scheme);
    expect(mustInstance(session.state, hero).damage).toBe(2);
    expect(mustInstance(session.state, scheme).threat).toBe(4);
  });
});
