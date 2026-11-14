/**
 * Slothful Endurance (community pack `mephisto-nep` 10) on a hero, end to end through a villain attack: "Your identity
 * cannot take damage less than its DEF from each attack. Double the DEF value of your identity." — `RuleSpec
 * multiplyStat` (DEF x 2) and `RuleSpec minDamageTakenPerAttack` (its DEF, read with the hero bound to `affected`).
 *
 * The hero's printed DEF is 2, so 4 with the doubling. The villain attacks with no boost card (ATK 2 or 6).
 * - Undefended: ATK 2 is raised to 4; ATK 6 stays 6.
 * - Defended by the hero: 6 − 4 = 2 is raised to 4; 2 − 4 = 0 deals nothing, and damage of 0 is not raised (an
 *   engine interpretation, `RuleSpec minDamageTakenPerAttack`).
 * - Prevention (rules-expert verdict, RRG 1.8 "Cannot" p. 11 over "Prevent" p. 35): a partial prevention, by a
 *   "prevent 3 of that damage" interrupt (Cosmic Flight's shape, made forced so no choice is asked) or a "prevent 3
 *   damage from this attack" budget (`modifyAttack.preventDamage`), cannot take the damage below the floor; preventing
 *   all of it, or a tough status card, leaves 0, which is not raised.
 * - Damage that is not an attack's (a treachery's) has no floor.
 *
 * Synthetic cards only.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { startSession } from "./engine.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const YOUR_IDENTITY: TargetQuery = { categories: ["identity"], controller: "you" };
const constant = (id: string, rules: readonly RuleSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] } satisfies AbilityDefinition);

const SLOTH_RULE = constant("sloth.constant", [
  { kind: "multiplyStat", stat: "def", factor: 2, target: YOUR_IDENTITY },
  {
    kind: "minDamageTakenPerAttack",
    target: YOUR_IDENTITY,
    amount: { kind: "stat", of: { kind: "slot", slot: "affected" }, stat: "def" },
  },
]);
const SLOTH = stubSupport({ id: "sloth", cost: 0, abilities: [SLOTH_RULE.ref] });
/** "Forced Interrupt: When your hero would take damage from an attack, prevent 3 of that damage." */
const SHIELD_RULE = stubAbility("shield.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: YOUR_IDENTITY, fromAttack: true } },
  effects: [{ kind: "preventDamage", amount: { kind: "const", value: 3 } }],
});
const SHIELD = stubSupport({ id: "shield", cost: 0, abilities: [SHIELD_RULE.ref] });
/** "Forced Interrupt: When the villain attacks you, prevent 3 damage from that attack" (an attack's prevent budget). */
const BRACE_RULE = stubAbility("brace.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack" } },
  effects: [{ kind: "modifyAttack", preventDamage: { kind: "const", value: 3 } }],
});
const BRACE = stubSupport({ id: "brace", cost: 0, abilities: [BRACE_RULE.ref] });
/** "Forced Interrupt: When your hero would take damage from an attack, prevent all of that damage." */
const WALL_RULE = stubAbility("wall.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: YOUR_IDENTITY, fromAttack: true } },
  effects: [{ kind: "preventDamage" }],
});
const WALL = stubSupport({ id: "wall", cost: 0, abilities: [WALL_RULE.ref] });
/** A treachery's damage: "deal 1 damage to your hero" (no attack). */
const SINGE_ABILITY = stubAbility("singe.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: YOUR_IDENTITY },
      amount: { kind: "const", value: 1 },
    },
  ] satisfies EffectSpec[],
});
const SINGE = stubEvent({ id: "singe", cost: 0, abilities: [SINGE_ABILITY.ref] });
/** "Give your hero a tough status card." */
const TOUGHEN_ABILITY = stubAbility("toughen.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "giveStatus", target: { kind: "each", query: YOUR_IDENTITY }, status: "tough" },
  ] satisfies EffectSpec[],
});
const TOUGHEN = stubEvent({ id: "toughen", cost: 0, abilities: [TOUGHEN_ABILITY.ref] });

/** "The villain attacks you. It gets no boost card." */
const ATTACKED_ABILITY = stubAbility("attacked.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "enemyActivation", enemies: { kind: "villain" }, against: { kind: "controller" }, boost: false },
  ] satisfies EffectSpec[],
});
const ATTACKED = stubEvent({ id: "attacked", cost: 0, abilities: [ATTACKED_ABILITY.ref] });

const villain = (atk: number) => stubVillain({ id: `villain-${atk}`, stages: [{ hp: flat(40), atk, sch: 1 }] });
const WEAK = villain(2);
const STRONG = villain(6);
const FIVE = villain(5);

const deps: EngineDeps = depsOf(
  SLOTH_RULE,
  SHIELD_RULE,
  BRACE_RULE,
  WALL_RULE,
  ATTACKED_ABILITY,
  SINGE_ABILITY,
  TOUGHEN_ABILITY,
);

function start(v: typeof WEAK, guard?: typeof SHIELD): GameState {
  const state = gameAtFirstTurn({
    cards: [WEAK, STRONG, FIVE, SLOTH, SHIELD, BRACE, WALL, ATTACKED, SINGE, TOUGHEN],
    deps,
    villain: v,
    deck: [SLOTH.id, SHIELD.id, BRACE.id, WALL.id, ...copiesOf(ATTACKED.id, 2), SINGE.id, TOUGHEN.id],
  });
  const hero = { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
  const slothful = playerCardIntoPlay(hero as GameState, SLOTH.id).state;
  return guard ? playerCardIntoPlay(slothful, guard.id).state : slothful;
}

/** Plays a 0-cost event for P1 and returns the state after it. */
function played(state: GameState, card: typeof SINGE): GameState {
  const given = giveCard(state, P1, card.id);
  return driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]).session.state;
}

/** The hero's damage after the villain attacks; `defend`: the hero defends. */
function attacked(state: GameState, defend: boolean): number {
  const hero = mustPlayer(state, P1).identity.instanceId;
  const given = giveCard(state, P1, ATTACKED.id);
  const before = mustInstance(given.state, hero).damage;
  const { session } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    (s) => (s.pendingChoice?.prompt.kind === "declareDefender" && defend ? [hero] : defaultPick(s)),
  );
  return mustInstance(session.state, hero).damage - before;
}

describe("Slothful Endurance on a hero: DEF doubled, and no less than DEF from each attack", () => {
  it("the hero's DEF is 2 x 2 = 4", () => {
    const state = start(WEAK);
    expect(characterProfile(state, mustPlayer(state, P1).identity.instanceId, deps)!.def).toBe(4);
  });

  it("undefended: ATK 2 is raised to 4; ATK 6 stays 6", () => {
    expect(attacked(start(WEAK), false)).toBe(4);
    expect(attacked(start(STRONG), false)).toBe(6);
  });

  it("defended by the hero: 5 - 4 = 1 and 6 - 4 = 2 are raised to 4; 2 - 4 = 0 deals nothing and is not raised", () => {
    expect(attacked(start(FIVE), true)).toBe(4);
    expect(attacked(start(STRONG), true)).toBe(4);
    expect(attacked(start(WEAK), true)).toBe(0);
  });

  it("a 'prevent 3 of that damage' interrupt cannot take an undefended ATK 6 below DEF: 4 is taken", () => {
    expect(attacked(start(STRONG, SHIELD), false)).toBe(4);
  });

  it("a 'prevent 3 damage from this attack' budget cannot either: 4 is taken", () => {
    expect(attacked(start(STRONG, BRACE), false)).toBe(4);
  });

  it("preventing all of it, or a tough status card, leaves 0, which is not raised", () => {
    expect(attacked(start(STRONG, WALL), false)).toBe(0);
    const tough = played(start(STRONG), TOUGHEN);
    expect(attacked(tough, false)).toBe(0);
  });

  it("damage that is not from an attack (a treachery's 1) has no floor", () => {
    const state = start(WEAK);
    const hero = mustPlayer(state, P1).identity.instanceId;
    expect(mustInstance(played(state, SINGE), hero).damage - mustInstance(state, hero).damage).toBe(1);
  });
});
