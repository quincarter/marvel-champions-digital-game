/**
 * docs/phase7-wave6.md §3.31: `EffectSpec modifyConsequentialDamage`, the one-shot change to an ally's pending
 * consequential damage. Synthetic allies shaped like Dust (`cyclops` 33012: "Interrupt: When Dust attacks a minion, …
 * Dust takes +1 consequential damage after this attack.") and one whose interrupt takes 5 off.
 *
 * Sources: RRG 1.8 "Consequential Damage" (p. 13: put on the stack with the basic power, resolved after it), "Interrupt"
 * (p. 24).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const modifying = (id: string, value: number) =>
  stubAbility(id, {
    trigger: { kind: "interrupt", forced: false, on: { on: "attack", selfIs: "source" } },
    effects: [{ kind: "modifyConsequentialDamage", character: self, amount: { kind: "const", value } }],
  });
const PLUS = modifying("dusty.interrupt", 1);
const MINUS = modifying("shrug.interrupt", -5);
const DUSTY = stubAlly({ id: "dusty", cost: 3, atk: 1, thw: 1, hp: 4, consequentialAttack: 1, abilities: [PLUS.ref] });
const SHRUG = stubAlly({ id: "shrug", cost: 3, atk: 1, thw: 1, hp: 4, consequentialAttack: 2, abilities: [MINUS.ref] });
const deps: EngineDeps = depsOf(PLUS, MINUS);

function start(ally: typeof DUSTY): { state: GameState; ally: InstanceId } {
  const base = gameAtFirstTurn({ cards: [DUSTY, SHRUG], deps, deck: [ally.id] });
  const placed = playerCardIntoPlay(base, ally.id);
  return { state: placed.state, ally: placed.id };
}

/** The ally attacks the villain; its interrupt is taken when `take`, else declined. */
function attack(state: GameState, ally: InstanceId, take: boolean) {
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") return take ? choice.options.slice(0, 1).map((o) => o.optionId) : [];
    return defaultPick(current);
  };
  return driveSession(
    startSession(state),
    deps,
    [{ type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: state.villains[0]!.instanceId }],
    pick,
  );
}

const modified = (events: readonly GameEvent[]) => events.filter((e) => e.type === "consequentialDamageModified");

describe("§3.31 `modifyConsequentialDamage`: 'takes +1 consequential damage after this attack'", () => {
  it("an interrupt to the attack adds 1 to that attack's consequential damage, logged", () => {
    const { state, ally } = start(DUSTY);
    const { session, events } = attack(state, ally, true);
    expect(mustInstance(session.state, ally).damage).toBe(2);
    expect(modified(events)).toEqual([{ type: "consequentialDamageModified", instanceId: ally, from: 1, to: 2 }]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("declined, the ally takes its printed consequential damage", () => {
    const { state, ally } = start(DUSTY);
    const { session, events } = attack(state, ally, false);
    expect(mustInstance(session.state, ally).damage).toBe(1);
    expect(modified(events)).toEqual([]);
  });

  it("a reduction never takes the damage below 0", () => {
    const { state, ally } = start(SHRUG);
    const { session, events } = attack(state, ally, true);
    expect(mustInstance(session.state, ally).damage).toBe(0);
    expect(modified(events)).toEqual([{ type: "consequentialDamageModified", instanceId: ally, from: 2, to: 0 }]);
  });
});
