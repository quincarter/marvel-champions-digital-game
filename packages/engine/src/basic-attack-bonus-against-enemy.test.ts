/**
 * docs/phase7-wave6.md §3.43: a lasting bonus for basic attacks against one enemy, read per affected character.
 * Synthetic cards shaped like Jubilee (35003: "choose an enemy. Until the end of the phase, while Wolverine or Jubilee
 * is making a basic attack against that enemy, they get +2 ATK for that attack").
 *
 * - `Predicate attackInProgress.basic`: only a character's basic attack (RRG 1.8 "Basic Power", p. 10).
 * - `modifyStatUntil` binds the card being read to `AFFECTED_SLOT`, so "they" is the attacker only.
 * - Ruling, June 2, 2026 (1): keyed on the chosen enemy; each trigger in the phase stacks (§4.1 of wave 6).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { statBonus } from "./modifiers.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const YOUR_IDENTITY = { kind: "identityOf", player: { kind: "controller" } } as const;

/** "Choose an enemy. Until the end of the phase, while [a character] is making a basic attack against that enemy, they get +2 ATK." */
const CHEER_ACTION = stubAbility("cheer.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseTarget", slot: "enemy", query: { categories: ["enemy"] }, chooser: { kind: "controller" } },
    {
      kind: "modifyStatUntil",
      stat: "atk",
      amount: {
        kind: "conditional",
        if: { kind: "attackInProgress", attacker: { inSlot: "affected" }, target: { inSlot: "enemy" }, basic: true },
        then: n(2),
        else: n(0),
      },
      affects: { categories: ["identity", "ally"] },
      until: "endOfPhase",
    },
  ],
});
const CHEER = stubSupport({ id: "cheer", cost: 0, abilities: [CHEER_ACTION.ref] });
/** "(attack): Deal damage equal to your ATK to the villain." An ability's attack, not a basic one. */
const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "stat", of: YOUR_IDENTITY, stat: "atk" } }],
});
const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [ZAP_ACTION.ref] });
/**
 * "Forced Interrupt: When the villain would take damage, deal damage equal to your hero's ATK to [the grunt]": reads the
 * hero's ATK while the attack is resolving, which is where "for that attack" applies.
 */
const ECHO_INTERRUPT = stubAbility("echo.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["minion"] } },
      amount: { kind: "stat", of: YOUR_IDENTITY, stat: "atk" },
    },
  ],
});
const ECHO = stubSupport({ id: "echo", cost: 0, abilities: [ECHO_INTERRUPT.ref] });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 5 });
const GRUNT = stubMinion({ id: "grunt", atk: 0, sch: 0, hp: 20 });
const VILLAIN = stubVillain({ id: "big-villain", stages: [{ hp: flat(40), atk: 1, sch: 0 }] });
const deps: EngineDeps = depsOf(CHEER_ACTION, ZAP_ACTION, ECHO_INTERRUPT);

interface Table {
  readonly state: GameState;
  readonly cheer: InstanceId;
  readonly buddy: InstanceId;
  readonly grunt: InstanceId;
  readonly villain: InstanceId;
  readonly hero: InstanceId;
}

function table(): Table {
  const base = gameAtFirstTurn({
    cards: [CHEER, ZAP, ECHO, BUDDY, GRUNT, VILLAIN],
    deps,
    villain: VILLAIN,
    encounter: [GRUNT.id, ...copiesOf(GRUNT.id, 5)],
    deck: [CHEER.id, ZAP.id, ECHO.id, BUDDY.id],
  });
  const withCheer = playerCardIntoPlay(base, CHEER.id);
  const withBuddy = playerCardIntoPlay(withCheer.state, BUDDY.id);
  const engaged = minionEngagedWith(withBuddy.state, GRUNT.id);
  const hero = mustPlayer(engaged.state, P1).identity.form === "hero";
  const state = hero
    ? engaged.state
    : driveSession(startSession(engaged.state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
  return {
    state,
    cheer: withCheer.id,
    buddy: withBuddy.id,
    grunt: engaged.id,
    villain: state.villains[0]!.instanceId,
    hero: mustPlayer(state, P1).identity.instanceId,
  };
}

/** Answers a target choice with `id` when offered, anything else as the default does. */
const aiming =
  (id: InstanceId) =>
  (state: GameState): readonly string[] =>
    state.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : defaultPick(state);

function run(state: GameState, enemy: InstanceId, ...commands: Command[]): GameSession {
  const { session } = driveSession(startSession(state), deps, commands, aiming(enemy));
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return session;
}

const cheer = (t: Table): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: t.cheer,
  abilityId: CHEER_ACTION.ref.id,
  payment: [],
});
const basic = (attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;

describe("§3.43 a lasting bonus for basic attacks against one enemy, read per attacker", () => {
  it("the hero's basic attack on the chosen enemy gets +2; outside an attack the ATK is unchanged", () => {
    const t = table();
    const cheered = run(t.state, t.villain, cheer(t)).state;
    expect(statBonus(cheered, deps, t.hero, "atk")).toBe(0);
    const after = run(cheered, t.villain, basic(t.hero, t.villain)).state;
    expect(damageOn(after, t.villain)).toBe(4);
  });

  it("an ally's basic attack on that enemy gets it too, and only the ally does ('they')", () => {
    const t = table();
    const watched = playerCardIntoPlay(t.state, ECHO.id).state;
    const after = run(watched, t.villain, cheer(t), basic(t.buddy, t.villain)).state;
    expect(damageOn(after, t.villain)).toBe(3);
    // The hero's ATK read during the ally's attack: not raised.
    expect(damageOn(after, t.grunt)).toBe(2);
  });

  it("a basic attack on another enemy does not", () => {
    const t = table();
    const after = run(t.state, t.villain, cheer(t), basic(t.hero, t.grunt)).state;
    expect(damageOn(after, t.grunt)).toBe(2);
  });

  it("while the hero's basic attack resolves his ATK is +2; during an ability's attack on that enemy it is not", () => {
    const t = table();
    const watched = playerCardIntoPlay(t.state, ECHO.id).state;
    const basicRun = run(watched, t.villain, cheer(t), basic(t.hero, t.villain)).state;
    expect(damageOn(basicRun, t.villain)).toBe(4);
    expect(damageOn(basicRun, t.grunt)).toBe(4);
    const given = giveCard(watched, P1, ZAP.id);
    const zapRun = run(given.state, t.villain, cheer(t), {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
    expect(damageOn(zapRun, t.villain)).toBe(2);
    expect(damageOn(zapRun, t.grunt)).toBe(2);
  });

  it("two triggers stack (ruling Jun 2, 2026 (1))", () => {
    const t = table();
    const after = run(t.state, t.villain, cheer(t), cheer(t), basic(t.hero, t.villain)).state;
    expect(damageOn(after, t.villain)).toBe(6);
  });

  it("ends with the phase", () => {
    const t = table();
    const cheered = run(t.state, t.villain, cheer(t)).state;
    expect(cheered.lastingEffects.filter((e) => e.kind === "statModifier")).toHaveLength(1);
    const ended = run(cheered, t.villain, { type: "endTurn", playerId: P1 }).state;
    expect(ended.lastingEffects.filter((e) => e.kind === "statModifier")).toEqual([]);
  });
});
