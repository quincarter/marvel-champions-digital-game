/**
 * docs/phase7-wave6.md §3.31: damage-taken rules scoped to an ally's consequential damage (`ConsequentialDamageScope`
 * on `reduceDamageTaken`, `increaseDamageTaken` and `preventAllDamage`). "Cannonball takes -1 consequential damage
 * after he attacks and defeats a minion" (`mut_gen` 32091); "Until the end of the phase, prevent all consequential
 * damage each ally would take from attacking / thwarting" (Group Assault 32183, Rescue Operation 32193).
 *
 * RRG 1.8 "Consequential Damage" (p. 13): the ally takes it after the attack or thwart resolves; RRG 1.8 "Prevent"
 * (p. 34): prevented damage is dealt but not taken. Synthetic cards: an ally with 1 consequential damage on each power,
 * a support carrying the rule under test, minions to attack and a side scheme to thwart.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

/** "Action: deal 1 damage to this ally": damage that is not consequential. */
const SELF_HARM = stubAbility("grunt.self-harm", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "self" }, amount: { kind: "const", value: 1 } }],
});
const GRUNT = stubAlly({ id: "grunt", cost: 0, atk: 1, thw: 1, hp: 9, abilities: [SELF_HARM.ref] });
const STURDY = stubMinion({ id: "sturdy", atk: 0, sch: 0, hp: 20 });
const FRAIL = stubMinion({ id: "frail", atk: 0, sch: 0, hp: 1 });
const PLOT = stubSideScheme({ id: "plot", startingThreat: 5 });

interface Table {
  readonly state: GameState;
  readonly deps: EngineDeps;
  readonly grunt: InstanceId;
  readonly sturdy: InstanceId;
  readonly frail: InstanceId;
  readonly plot: InstanceId;
}

/** A table where a support in play carries `rules` as a constant ability. */
function table(name: string, rules: readonly RuleSpec[]): Table {
  const aura = stubAbility(`aura.${name}`, { trigger: { kind: "constant", rules }, effects: [] });
  const AURA = stubSupport({ id: `aura-${name}`, cost: 0, abilities: [aura.ref] });
  const deps = depsOf(SELF_HARM, aura);
  const encounter: readonly CardId[] = [STURDY.id, FRAIL.id, PLOT.id];
  const base = gameAtFirstTurn({
    cards: [GRUNT, AURA, STURDY, FRAIL, PLOT],
    deps,
    deck: [GRUNT.id, AURA.id],
    encounter,
  });
  const withAura = playerCardIntoPlay(base, AURA.id);
  const grunt = playerCardIntoPlay(withAura.state, GRUNT.id);
  const sturdy = minionEngagedWith(grunt.state, STURDY.id);
  const frail = minionEngagedWith(sturdy.state, FRAIL.id);
  const plot = encounterCardInVillainArea(frail.state, PLOT.id, 5);
  return { state: plot.state, deps, grunt: grunt.id, sturdy: sturdy.id, frail: frail.id, plot: plot.id };
}

const attack = (t: Table, target: InstanceId) =>
  runCommandsPicking(t.state, t.deps, defaultPick, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: t.grunt,
    targetInstanceId: target,
  });
const thwart = (t: Table) =>
  runCommandsPicking(t.state, t.deps, defaultPick, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: t.grunt,
    schemeInstanceId: t.plot,
  });
const selfHarm = (t: Table) =>
  runCommandsPicking(t.state, t.deps, defaultPick, {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: t.grunt,
    abilityId: SELF_HARM.ref.id,
    payment: [],
  });

const ALLIES = { categories: ["ally" as const] };
const MINUS_ONE: RuleSpec = { kind: "reduceDamageTaken", target: ALLIES, amount: 1, consequential: { from: "attack" } };
const PREVENT_ATTACKING: RuleSpec = { kind: "preventAllDamage", target: ALLIES, consequential: { from: "attack" } };

describe("§3.31 rules on an ally's consequential damage", () => {
  it("'-1 consequential damage': an ally with 1 consequential damage takes 0 after attacking; replay deep-equals", () => {
    const t = table("minus", [MINUS_ONE]);
    const { state, events, session } = attack(t, t.sturdy);
    expect(mustInstance(state, t.sturdy).damage).toBe(1);
    expect(mustInstance(state, t.grunt).damage).toBe(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damagePrevented", targetInstanceId: t.grunt, reason: "reduced" }),
    );
    const replayed = replay(session.log, t.deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("'from attacking' leaves the thwart's consequential damage alone", () => {
    const t = table("minus-thwart", [MINUS_ONE]);
    expect(mustInstance(thwart(t).state, t.grunt).damage).toBe(1);
  });

  it("a consequential-scoped rule leaves non-consequential damage alone", () => {
    const t = table("minus-other", [MINUS_ONE]);
    expect(mustInstance(selfHarm(t).state, t.grunt).damage).toBe(1);
  });

  it("'+1 consequential damage' (`increaseDamageTaken`) adds to it, 'any' power", () => {
    const t = table("plus", [
      { kind: "increaseDamageTaken", target: ALLIES, amount: 1, consequential: { from: "any" } },
    ]);
    expect(mustInstance(thwart(t).state, t.grunt).damage).toBe(2);
    expect(mustInstance(selfHarm(t).state, t.grunt).damage).toBe(1);
  });

  it("'prevent all': takes 0, prevented by the rule's card, not counted as damage taken; replay deep-equals", () => {
    const t = table("prevent", [PREVENT_ATTACKING]);
    const { state, events, session } = attack(t, t.sturdy);
    const grunt = mustInstance(state, t.grunt);
    expect(grunt.damage).toBe(0);
    expect(grunt.damageTakenThisPhase ?? 0).toBe(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damagePrevented", targetInstanceId: t.grunt, amount: 1, reason: "effect" }),
    );
    const replayed = replay(session.log, t.deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("'prevent all … from attacking' does not reach the thwart's, nor non-consequential damage", () => {
    const t = table("prevent-other", [PREVENT_ATTACKING]);
    expect(mustInstance(thwart(t).state, t.grunt).damage).toBe(1);
    expect(mustInstance(selfHarm(t).state, t.grunt).damage).toBe(1);
  });

  it("'prevent all … from thwarting' covers the thwart only", () => {
    const t = table("prevent-thwart", [
      { kind: "preventAllDamage", target: ALLIES, consequential: { from: "thwart" } },
    ]);
    expect(mustInstance(thwart(t).state, t.grunt).damage).toBe(0);
    expect(mustInstance(attack(t, t.sturdy).state, t.grunt).damage).toBe(1);
  });

  describe("`if` reads the attack's reported results ('after he attacks and defeats a minion')", () => {
    const DEFEATS_A_MINION: RuleSpec = {
      kind: "reduceDamageTaken",
      target: ALLIES,
      amount: 1,
      consequential: {
        from: "attack",
        if: {
          kind: "and",
          of: [
            { kind: "varAtLeast", name: "attack.defeated", amount: 1 },
            {
              kind: "refMatches",
              ref: { kind: "slot", slot: "attack.damaged" },
              query: { categories: ["minion"] },
              anywhere: true,
            },
          ],
        },
      },
    };

    it("applies when the attack defeated the minion", () => {
      const t = table("defeats", [DEFEATS_A_MINION]);
      const { state, session } = attack(t, t.frail);
      expect(cardsInPlay(state)).not.toContain(t.frail);
      expect(mustInstance(state, t.grunt).damage).toBe(0);
      const replayed = replay(session.log, t.deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(session.state);
    });

    it("does not apply when the minion survives", () => {
      const t = table("survives", [DEFEATS_A_MINION]);
      expect(mustInstance(attack(t, t.sturdy).state, t.grunt).damage).toBe(1);
    });
  });
});
