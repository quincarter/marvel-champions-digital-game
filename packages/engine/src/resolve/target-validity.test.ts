/**
 * Target validity of an attack against a Tough enemy that cannot take damage (`target-validity.ts`,
 * `pierceForDamage`): a piercing attack keeps a target with a tough status card that "cannot take damage", and removes
 * its tough card. RRG 1.8 "Target" (p. 43): a target is valid "if any part of that ability can affect that target";
 * "Piercing" (p. 32) discards tough cards before the attack deals damage. Ruling July 11, 2025: "A target that
 * 'cannot take damage' is only an invalid target for an ability that solely deals damage to it; Piercing Strike's
 * alteration effect makes it so that an enemy with Tough can still be its target, even if that same enemy 'cannot take
 * damage,' resulting in the Tough status card being removed."
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "../commands.js";
import { applyCommand } from "../engine.js";
import { playerId, type InstanceId } from "../ids.js";
import { activeVillain, mustInstance, mustPlayer } from "../query.js";
import type { EffectSpec } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { stubEvent, stubMainScheme, stubMinion, stubSupport, stubVillain } from "../testing/fixtures.js";
import { giveCard, newGame, RESOURCE, runWith, settle } from "../testing/scenario.js";

const p1 = playerId("p1");
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(50), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 9, boostIcons: 0 });
/** "The villain cannot take damage." */
const SHIELD_RULE = stubAbility("shield.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotTakeDamage", target: { categories: ["villain"] } }] },
  effects: [],
});
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_RULE.ref] });
/** "The villain cannot be dealt damage." (Jackknifed Tanker Truck 60131's shape, docs/phase7-wave11-scenarios.md §S3.5) */
const WALL_RULE = stubAbility("wall.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "cannotTakeDamage", target: { categories: ["villain"] }, stage: "dealt" }],
  },
  effects: [],
});
const WALL = stubSupport({ id: "wall", cost: 0, abilities: [WALL_RULE.ref] });
/** "Your basic attacks gain piercing." */
const CLAWS_RULE = stubAbility("claws.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "attackKeywords", keywords: ["piercing"], attacker: { categories: ["identity"] }, basicOnly: true },
    ],
  },
  effects: [],
});
const CLAWS = stubSupport({ id: "claws", cost: 0, abilities: [CLAWS_RULE.ref] });
/** Piercing Strike's shape: "Hero Action (attack): Deal 3 damage to an enemy. This attack gains piercing." */
const STRIKE_ABILITY = stubAbility("strike.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [
    {
      kind: "chooseTarget",
      slot: "enemy",
      chooser: { kind: "controller" },
      query: { categories: ["enemy"], attackableBy: { kind: "identityOf", player: { kind: "controller" } } },
    },
    {
      kind: "attack",
      target: { kind: "slot", slot: "enemy" },
      amount: { kind: "const", value: 3 },
      keywords: ["piercing"],
    },
  ] satisfies EffectSpec[],
});
const STRIKE = stubEvent({ id: "strike", cost: 0, abilities: [STRIKE_ABILITY.ref] });
const deps = depsOf(SHIELD_RULE, WALL_RULE, CLAWS_RULE, STRIKE_ABILITY);

const playFree = (state: GameState, card: string): GameState => {
  const given = giveCard(state, p1, card);
  return runWith(deps, given.state, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
};

/**
 * P1's second turn in hero form, the villain under "cannot take damage" (or `rule`), with `tough` tough cards and
 * `supports`.
 */
function table(tough: number, supports: readonly string[], rule: string = SHIELD.id) {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [THUG, SHIELD, WALL, CLAWS, STRIKE],
    encounterDeck: Array.from({ length: 12 }, () => THUG.id),
    deck: [...Array.from({ length: 17 }, () => RESOURCE.id), SHIELD.id, WALL.id, CLAWS.id, STRIKE.id],
    deps,
  });
  let state = settle(
    runWith(deps, start, { type: "changeForm", playerId: p1 }, { type: "endTurn", playerId: p1 }),
    undefined,
    deps,
  );
  for (const support of [rule, ...supports]) state = playFree(state, support);
  const villain = activeVillain(state).instanceId;
  state = {
    ...state,
    instances: {
      ...state.instances,
      [villain]: { ...mustInstance(state, villain), statuses: { stunned: 0, confused: 0, tough } },
    },
  };
  return { state, villain, hero: mustPlayer(state, p1).identity.instanceId as InstanceId };
}

const basicAttack = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: p1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

describe("a piercing attack on a Tough enemy that cannot take damage (RRG 1.8 pp. 32, 43; ruling Jul 11, 2025)", () => {
  it("Piercing Strike: the Tough status card is discarded although the villain cannot take the damage", () => {
    // RRG 1.8 p. 43 "Target" matches the first half of the ruling; p. 32 "Piercing" says the attack discards the tough
    // cards before it deals damage and is silent about a target that cannot take it. The engine (`pierceForDamage`)
    // skips piercing when the damage cannot be taken, so the tough card stays.
    const at = table(1, []);
    const given = giveCard(at.state, p1, STRIKE.id);
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    // Expected: the event is playable (the enemy with Tough is a valid target through piercing) and, after it resolves,
    // the villain's Tough card is gone. Actual: see the assertions.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const offered = result.state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    expect(offered).toContain(at.villain); // actual: only the minion is offered
    const after = settle(result.state, () => [at.villain], deps);
    expect(mustInstance(after, at.villain).statuses.tough).toBe(0);
  });

  it("a basic attack that gains piercing may target it, and its tough card is discarded", () => {
    const at = table(1, [CLAWS.id]);
    const result = applyCommand(at.state, basicAttack(at.hero, at.villain), deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = settle(result.state, undefined, deps);
    expect(mustInstance(after, at.villain).statuses.tough).toBe(0);
    expect(mustInstance(after, at.villain).damage).toBe(0);
  });

  it("control: without a tough card the piercing basic attack has nothing to affect and is refused", () => {
    const at = table(0, [CLAWS.id]);
    const result = applyCommand(at.state, basicAttack(at.hero, at.villain), deps);
    expect(result.ok).toBe(false);
  });

  it("control: a basic attack without piercing cannot target the Tough enemy", () => {
    const at = table(1, []);
    const result = applyCommand(at.state, basicAttack(at.hero, at.villain), deps);
    expect(result.ok).toBe(false);
  });

  it("control: without a tough card the piercing event does not offer the enemy", () => {
    const at = table(0, []);
    const given = giveCard(at.state, p1, STRIKE.id);
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const offered = result.state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    expect(offered).not.toContain(at.villain);
  });
});

describe("'cannot be dealt damage' gives piercing nothing to act on (RRG 1.8 'Piercing', p. 32; §S3.5)", () => {
  // Unlike "cannot take damage" (Ruling 69.76 above), no damage is dealt, so piercing discards no tough card and the
  // attack has no effect on the target: an attack that only deals damage cannot target it.
  it("a basic attack that gains piercing is refused against the Tough villain", () => {
    const at = table(1, [CLAWS.id], WALL.id);
    const result = applyCommand(at.state, basicAttack(at.hero, at.villain), deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("no_valid_target");
    expect(mustInstance(at.state, at.villain).statuses.tough).toBe(1);
  });

  it("Piercing Strike does not offer the Tough villain", () => {
    const at = table(1, [], WALL.id);
    const given = giveCard(at.state, p1, STRIKE.id);
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: p1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    // The engaged minion is still a target, so the event plays; the villain is not among the choices.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const offered = result.state.pendingChoice?.options.map((o) => o.optionId) ?? [];
    expect(offered.length).toBeGreaterThan(0);
    expect(offered).not.toContain(at.villain);
  });
});
