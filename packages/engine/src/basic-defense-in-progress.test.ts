/**
 * One reading of "a hero is making a basic defense of this enemy attack" (`basicDefenseInProgress`, `stack.ts`), shared
 * by the `usingBasicPower` predicate ("If Elektra is using a basic power", the Ninja cards 63002–63004) and "+N to that
 * power for this use" (`modifyBasicPower`, `basicPowerBeingUsed`): from the moment the defender is declared until the
 * attack is done (RRG 1.8 "Attack (Enemy Activation)", p. 9; rules verdict Q3, docs/phase7-elektra-iron-fist.md). The
 * two used to disagree on the declare-defender stage.
 */

import { describe, expect, it } from "vitest";
import { frameId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { evaluate } from "./select.js";
import { basicDefenseInProgress, type StackFrame } from "./stack.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubAlly } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const deps = depsOf();
const ALLY = stubAlly({ id: "defending-ally", cost: 0, atk: 1, thw: 1, hp: 3 });
const game = gameAtFirstTurn({ cards: [ALLY], deps, deck: [ALLY.id] });
const withAlly = playerCardIntoPlay(game, ALLY.id, P1);
const base = withAlly.state;
const ally = withAlly.id;
const hero = mustPlayer(base, P1).identity.instanceId;
const boss = base.villains[0]!.instanceId;

type AttackFrame = Extract<StackFrame, { kind: "enemyAttack" }>;
const attack = (stage: AttackFrame["stage"], basicDefense = true, defender: InstanceId | null = hero): AttackFrame => ({
  frameId: frameId("attack-procedure"),
  answer: null,
  kind: "enemyAttack",
  enemyInstanceId: boss,
  attackedPlayerId: P1,
  targetPlayerId: P1,
  targetInstanceId: hero,
  defenderInstanceId: defender,
  basicDefense,
  boostIcons: 0,
  stage,
  eventFrameId: frameId("attack-event"),
});
const withStack = (frame: StackFrame): GameState => ({ ...base, stack: [frame] });
const using = (state: GameState): boolean =>
  evaluate(state, { kind: "usingBasicPower" }, { selfInstanceId: null, controllerId: P1, event: null, bindings: {} });

describe("basicDefenseInProgress", () => {
  it("from the declared defense through the damage step: the defender and the attack's event frame", () => {
    for (const stage of ["declareDefender", "flipBoosts", "dealDamage"] as const)
      expect(basicDefenseInProgress(base, attack(stage))).toEqual({
        defenderId: hero,
        attackEventFrameId: frameId("attack-event"),
      });
  });

  it("not once the attack is done, not without a basic defense, not for a defender-less attack", () => {
    expect(basicDefenseInProgress(base, attack("done"))).toBeNull();
    expect(basicDefenseInProgress(base, attack("dealDamage", false))).toBeNull();
    expect(basicDefenseInProgress(base, attack("dealDamage", true, null))).toBeNull();
  });

  it("not for an ally's defense: allies do not use a basic power when they defend (ruling March 16, 2025)", () => {
    for (const stage of ["declareDefender", "flipBoosts", "dealDamage"] as const)
      expect(basicDefenseInProgress(base, attack(stage, true, ally))).toBeNull();
  });
});

describe("the usingBasicPower predicate agrees with it at every stage", () => {
  it("true while the declared defense is in progress, the declare-defender stage included", () => {
    for (const stage of ["declareDefender", "flipBoosts", "dealDamage"] as const)
      expect(using(withStack(attack(stage)))).toBe(true);
  });

  it("false once done, or for an attack nobody makes a basic defense against", () => {
    expect(using(withStack(attack("done")))).toBe(false);
    expect(using(withStack(attack("flipBoosts", false, null)))).toBe(false);
    expect(using(base)).toBe(false);
  });

  it("false while an ally defends (Melinda May ruling, March 16, 2025)", () => {
    expect(using(withStack(attack("dealDamage", true, ally)))).toBe(false);
  });
});
