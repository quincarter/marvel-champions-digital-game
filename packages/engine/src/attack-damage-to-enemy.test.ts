/**
 * docs/phase7-wave6.md §3.36: "Hero Interrupt (defense): When an enemy attacks you, choose a different enemy → damage
 * from that attack is dealt to the chosen enemy instead of you" (Psychic Misdirection, `phoenix` 34033).
 * `modifyAttack.damageTo`, from an interrupt to the `enemyAttack` in progress, sends the attack's damage (boost
 * included) to that enemy. Per §4.1 Q18 it is attack damage from the attacker (a tough status card on the enemy absorbs
 * it; no overkill spills), the enemy is not attacked (no retaliate from it), and your identity defended and took none.
 * Synthetic cards; the villain's ATK is 3 and each boost card has 1 boost icon, so the attack deals 4.
 */

import { flat, type KeywordInstance } from "@mc/content";
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
import { stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, runWith } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const theVillain = { kind: "named", name: "villain" } as const;

/** "Forced Interrupt (defense): When an enemy attacks you, damage from that attack is dealt to Goon instead of you." */
const MISDIRECT = stubAbility(
  "misdirect.forced-interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
    },
    label: ["defense"],
    effects: [{ kind: "modifyAttack", damageTo: { kind: "named", name: "goon" } }],
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
const MISDIRECTOR = stubSupport({ id: "misdirector", cost: 0, abilities: [MISDIRECT.ref] });
const ATTACKER = stubSupport({ id: "attacker", cost: 0, abilities: [ATTACK_ABILITY.ref] });
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });
const goon = (hp: number, keywords: readonly KeywordInstance[] = []) =>
  stubMinion({ id: "goon", atk: 1, sch: 1, hp, keywords });

const deps: EngineDeps = depsOf(MISDIRECT, ATTACK_ABILITY);

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
  readonly goon: InstanceId;
  readonly hero: InstanceId;
  readonly villain: InstanceId;
}

interface Options {
  readonly goonHp?: number;
  readonly goonKeywords?: readonly KeywordInstance[];
  readonly goonTough?: boolean;
  readonly villainKeywords?: readonly KeywordInstance[];
  readonly misdirect?: boolean;
}

function setup(options: Options = {}): Setup {
  const minion = goon(options.goonHp ?? 10, options.goonKeywords);
  const villain = stubVillain({
    id: "villain",
    stages: [
      { hp: flat(30), atk: 3, sch: 1, ...(options.villainKeywords ? { keywords: options.villainKeywords } : {}) },
    ],
  });
  let state = gameAtFirstTurn({
    cards: [MISDIRECTOR, ATTACKER, ONE_ICON, minion],
    deps,
    villain,
    deck: [MISDIRECTOR.id, ATTACKER.id],
    encounter: [minion.id, ...copiesOf(ONE_ICON.id, 30)],
  });
  const attacker = playerCardIntoPlay(state, ATTACKER.id);
  state = attacker.state;
  if (options.misdirect !== false) state = playerCardIntoPlay(state, MISDIRECTOR.id).state;
  const engaged = minionEngagedWith(state, minion.id);
  state = engaged.state;
  if (options.goonTough) {
    const g = state.instances[engaged.id]!;
    state = {
      ...state,
      instances: { ...state.instances, [engaged.id]: { ...g, statuses: { ...g.statuses, tough: 1 } } },
    };
  }
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  return {
    state,
    attacker: attacker.id,
    goon: engaged.id,
    hero: mustPlayer(state, P1).identity.instanceId,
    villain: activeVillain(state).instanceId,
  };
}

const run = (s: Setup, commands: readonly Command[]) =>
  driveSession(startSession(s.state), deps, commands, defaultPick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const damageOf = (state: GameState, id: InstanceId) => state.instances[id]?.damage ?? 0;

describe("modifyAttack damageTo — 'damage from that attack is dealt to the chosen enemy instead of you' (§3.36)", () => {
  it("without it, the attack deals ATK 3 + 1 boost icon to your hero", () => {
    const s = setup({ misdirect: false });
    const { session } = run(s, [use(s.attacker)]);
    expect(damageOf(session.state, s.hero)).toBe(4);
  });

  it("the attack's damage (boost included) goes to the chosen enemy as attack damage; your hero defended, took none", () => {
    const s = setup();
    const { session, events } = run(s, [use(s.attacker)]);
    expect(damageOf(session.state, s.goon)).toBe(4);
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(of(events, "attackResolved")).toEqual([
      expect.objectContaining({ targetInstanceId: s.hero, boostIcons: 1, damageDealt: 4, damageTo: s.goon }),
    ]);
    expect(of(events, "damageDealt")).toEqual([
      expect.objectContaining({ targetInstanceId: s.goon, amount: 4, sourceInstanceId: s.villain }),
    ]);
    // The "(defense)" label made your identity the defender (RRG 1.8 "Defend, Defense", p. 15).
    const defended = of(events, "triggerEvent").map((e) => e.event);
    expect(defended).toContainEqual(
      expect.objectContaining({ kind: "defended", defenderInstanceId: s.hero, basic: false }),
    );
  });

  it("a tough status card on the chosen enemy absorbs it (it is attack damage, §4.1 Q18)", () => {
    const s = setup({ goonTough: true });
    const { session, events } = run(s, [use(s.attacker)]);
    expect(of(events, "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: s.goon, amount: 4, reason: "tough" },
    ]);
    expect(session.state.instances[s.goon]!.statuses.tough).toBe(0);
    expect(damageOf(session.state, s.goon)).toBe(0);
    expect(damageOf(session.state, s.hero)).toBe(0);
  });

  it("the chosen enemy is not attacked: its retaliate does not fire, and the attacker's overkill spills nothing", () => {
    const s = setup({
      goonHp: 2,
      goonKeywords: [{ name: "retaliate", value: 1 }],
      villainKeywords: [{ name: "overkill" }],
    });
    const { session, events } = run(s, [use(s.attacker)]);
    expect(session.state.instances[s.goon]).toBeDefined();
    expect(of(events, "characterDefeated").map((e) => e.instanceId)).toEqual([s.goon]);
    expect(damageOf(session.state, s.villain)).toBe(0);
    expect(damageOf(session.state, s.hero)).toBe(0);
  });

  it("replays deep-equal", () => {
    const s = setup({ goonHp: 20 });
    const { session } = run(s, [use(s.attacker), use(s.attacker)]);
    expect(damageOf(session.state, s.goon)).toBe(8);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
