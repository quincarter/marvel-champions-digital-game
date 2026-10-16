/**
 * `TriggerEvent enemyAttackDamageStep`: the interrupt window at an enemy attack's damage step (RRG 1.8 "Attack (Enemy
 * Activation)", pp. 8-9: after step 2 has declared the defender and step 3 has resolved the boost cards, before step
 * 4's damage is dealt; "Interrupt", p. 25), and `modifyAttack.damageTo` naming an ally. "Forced Interrupt: When an enemy
 * resolves an undefended attack against you, deal that damage to [this ally]" (Robert Kelly, `mut_gen` 32066). Owner
 * decision 2026-10-16: an attack-triggered interrupt is scripted on the attack, not on its damage, so a tough status
 * card on the identity, which prevents damage as it is dealt (RRG 1.8 "Damage", p. 14), does not pre-empt it.
 * Synthetic cards; the villain's ATK is 3 and each boost card has 1 boost icon, so the attack deals 4.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, runWith } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const theVillain = { kind: "named", name: "villain" } as const;

/** "Forced Interrupt: When an enemy resolves an undefended attack against you, deal that damage to this ally." */
const BODYGUARD_INTERRUPT = stubAbility(
  "bodyguard.forced-interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: {
        on: "enemyAttackDamageStep",
        sourceIs: { categories: ["enemy"] },
        playerIs: "controller",
        eventAtLeast: { undefended: 1 },
      },
    },
    effects: [{ kind: "modifyAttack", damageTo: { kind: "self" } }],
  }),
);
/** "Action: the villain attacks you." */
const ATTACK_ABILITY = stubAbility(
  "attack.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "controller" } }],
  }),
);
const BODYGUARD = stubAlly({ id: "bodyguard", cost: 0, atk: 1, thw: 1, hp: 10, abilities: [BODYGUARD_INTERRUPT.ref] });
const ATTACKER = stubSupport({ id: "attacker", cost: 0, abilities: [ATTACK_ABILITY.ref] });
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });

const deps: EngineDeps = depsOf(BODYGUARD_INTERRUPT, ATTACK_ABILITY);

const use = (id: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: id,
  abilityId: ATTACK_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  readonly attacker: InstanceId;
  readonly bodyguard: InstanceId;
  readonly hero: InstanceId;
  readonly villain: InstanceId;
}

function setup(options: { readonly heroTough?: boolean } = {}): Setup {
  const villain = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 3, sch: 1 }] });
  let state = gameAtFirstTurn({
    cards: [BODYGUARD, ATTACKER, ONE_ICON],
    deps,
    villain,
    deck: [BODYGUARD.id, ATTACKER.id],
    encounter: copiesOf(ONE_ICON.id, 30),
  });
  const attacker = playerCardIntoPlay(state, ATTACKER.id);
  state = attacker.state;
  const bodyguard = playerCardIntoPlay(state, BODYGUARD.id);
  state = bodyguard.state;
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  const hero = mustPlayer(state, P1).identity.instanceId;
  if (options.heroTough) {
    const h = state.instances[hero]!;
    state = { ...state, instances: { ...state.instances, [hero]: { ...h, statuses: { ...h.statuses, tough: 1 } } } };
  }
  return { state, attacker: attacker.id, bodyguard: bodyguard.id, hero, villain: activeVillain(state).instanceId };
}

const run = (s: Setup, commands: readonly Command[], pick = defaultPick) =>
  driveSession(startSession(s.state), deps, commands, pick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const damageOf = (state: GameState, id: InstanceId) => state.instances[id]?.damage ?? 0;
const resolved = (events: readonly GameEvent[]) =>
  of(events, "abilityResolved").filter((e) => (e.abilityId as string) === BODYGUARD_INTERRUPT.ref.id);
const defendWithHero =
  (hero: InstanceId) =>
  (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "declareDefender" ? [hero] : defaultPick(state);

describe("enemyAttackDamageStep — an interrupt at the attack's damage step (RRG 1.8 pp. 8-9, p. 14)", () => {
  it("undefended, the hero with a tough status card: the whole attack goes to the ally, the hero keeps its tough card", () => {
    const s = setup({ heroTough: true });
    const { session, events } = run(s, [use(s.attacker)]);
    expect(resolved(events)).toHaveLength(1);
    expect(damageOf(session.state, s.bodyguard)).toBe(4);
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(session.state.instances[s.hero]!.statuses.tough).toBe(1);
    expect(of(events, "damagePrevented")).toEqual([]);
    expect(of(events, "interruptsPreempted")).toEqual([]);
    // Attack damage from the attacker, logged on the attack as redirected.
    expect(of(events, "damageDealt")).toEqual([
      expect.objectContaining({ targetInstanceId: s.bodyguard, amount: 4, sourceInstanceId: s.villain }),
    ]);
    expect(of(events, "attackResolved")).toEqual([
      expect.objectContaining({ targetInstanceId: s.hero, damageDealt: 4, damageTo: s.bodyguard }),
    ]);
  });

  it("undefended, no tough card: the same redirect; the window opens after the boost card and before any damage", () => {
    const s = setup();
    const { session, events } = run(s, [use(s.attacker)]);
    expect(damageOf(session.state, s.bodyguard)).toBe(4);
    expect(damageOf(session.state, s.hero)).toBe(0);
    const step = events.findIndex(
      (e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "enemyAttackDamageStep",
    );
    const boost = events.findIndex(
      (e) => e.type === "triggerEvent" && e.event.kind === "boostCardTurnedFaceup" && e.phase === "resolved",
    );
    const dealt = events.findIndex((e) => e.type === "damageDealt");
    expect(step).toBeGreaterThan(-1);
    if (boost > -1) expect(boost).toBeLessThan(step);
    expect(step).toBeLessThan(dealt);
    expect(events[step]).toMatchObject({
      event: { kind: "enemyAttackDamageStep", undefended: 1, defenderInstanceId: null, targetInstanceId: s.hero },
    });
  });

  it("a defended attack does not trigger it: the defender takes the attack, the ally nothing", () => {
    const s = setup();
    const { session, events } = run(s, [use(s.attacker)], defendWithHero(s.hero));
    expect(resolved(events)).toEqual([]);
    expect(damageOf(session.state, s.bodyguard)).toBe(0);
    expect(of(events, "attackResolved")).toEqual([expect.not.objectContaining({ damageTo: expect.anything() })]);
    expect(of(events, "damageDealt").every((e) => e.targetInstanceId !== s.bodyguard)).toBe(true);
  });

  it("replays deep-equal", () => {
    const s = setup({ heroTough: true });
    const { session } = run(s, [use(s.attacker), use(s.attacker)]);
    expect(damageOf(session.state, s.bodyguard)).toBe(8);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
