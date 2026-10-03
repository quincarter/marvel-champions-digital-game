/**
 * docs/phase7-wave6.md §3.81: "prevent N damage from this attack" set as the attack is initiated (Brazen Defense,
 * `mut_gen` 32178: "Hero Interrupt (attack/defense): When an enemy attacks, spend 1 resource of any type → prevent 3
 * damage from this attack and deal 3 damage to that enemy."). `modifyAttack.preventDamage` puts a budget on the
 * attack's own event frame, spent when the attack's damage is applied: after constant reductions and a tough status
 * card (RRG 1.8 "Damage", p. 14, steps 2-3; FAQ p. 58), dealt but not taken (RRG 1.8 "Prevent", p. 34), announced as
 * prevented, and gone with the attack. Synthetic cards; the villain's ATK is 5 and its attacks go undefended.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const theVillain = { kind: "named", name: "villain" } as const;
const you = { kind: "controller" } as const;

/** "Forced Interrupt: When the villain attacks you, prevent N damage from this attack." (a support's) */
const shield = (n: number) =>
  stubAbility(
    `shield${n}.forced-interrupt`,
    def({
      trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
      effects: [{ kind: "modifyAttack", preventDamage: { kind: "const", value: n } }],
    }),
  );
const SHIELD3 = shield(3);
const SHIELD9 = shield(9);
/** "Forced Response: After this card prevents damage, draw 1 card." */
const SHIELD_RESPONSE = stubAbility(
  "shield.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "damagePrevented", selfIs: "source", fromAttack: true } },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);
/** "Action: the villain attacks you." */
const ATTACK_ABILITY = stubAbility(
  "attack.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "enemyAttack", enemies: theVillain, against: you }] }),
);

const support = (id: string, abilities: readonly StubAbility[]) =>
  stubSupport({ id, cost: 0, abilities: abilities.map((a) => a.ref) });
const S3 = support("s3", [SHIELD3, SHIELD_RESPONSE]);
const S9 = support("s9", [SHIELD9]);
const ATTACK = support("attack", [ATTACK_ABILITY]);
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(SHIELD3, SHIELD9, SHIELD_RESPONSE, ATTACK_ABILITY);

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: ATTACK_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  readonly attack: InstanceId;
  readonly shield: InstanceId | null;
  readonly hero: InstanceId;
}

/** Villain ATK 5 with blank boost cards; hero form; `shieldCard` in play (or none) beside the attack support. */
function setup(shieldCard: typeof S3 | null, tough = false): Setup {
  const inPlay = [ATTACK, ...(shieldCard ? [shieldCard] : [])];
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 5, sch: 1 }] }),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [BLANK, S3, S9, ATTACK],
    deck: [...inPlay.map((c) => c.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(BLANK.id, 20),
    deps,
  });
  const given = giveCards(state, p1, ...inPlay.map((c) => c.id));
  const ids = given.ids as readonly InstanceId[];
  let ready = runWith(deps, given.state, { type: "changeForm", playerId: p1 }, ...ids.map(play));
  const hero = mustPlayer(ready, p1).identity.instanceId;
  if (tough) {
    const h = ready.instances[hero]!;
    ready = { ...ready, instances: { ...ready.instances, [hero]: { ...h, statuses: { ...h.statuses, tough: 1 } } } };
  }
  return { state: ready, attack: ids[0]!, shield: ids[1] ?? null, hero };
}

function run(s: Setup, commands: readonly Command[]) {
  return driveSession(startSession(s.state), deps, commands, defaultPick);
}
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("modifyAttack preventDamage — 'prevent N damage from this attack' (§3.81)", () => {
  it("an attack of 5 with prevent 3 deals 2, logs 3 prevented, and fires 'after damage is prevented'", () => {
    const s = setup(S3);
    const damage = s.state.instances[s.hero]!.damage;
    const hand = mustPlayer(s.state, p1).hand.length;
    const { session, events } = run(s, [use(s.attack)]);
    expect(of(events, "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: s.hero, amount: 3, reason: "effect" },
    ]);
    expect(of(events, "damageDealt").filter((e) => e.targetInstanceId === s.hero)).toEqual([
      expect.objectContaining({ amount: 2 }),
    ]);
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 2);
    // The shield's "after this card prevents damage" response drew a card.
    expect(mustPlayer(session.state, p1).hand.length).toBe(hand + 1);
  });

  it("prevent more than the damage: none is taken, and the attack damaged no one", () => {
    const s = setup(S9);
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s, [use(s.attack)]);
    expect(of(events, "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: s.hero, amount: 5, reason: "effect" },
    ]);
    expect(of(events, "damageDealt").filter((e) => e.targetInstanceId === s.hero)).toEqual([]);
    expect(session.state.instances[s.hero]!.damage).toBe(damage);
  });

  it("a tough status card comes first (RRG 1.8 p. 14 steps 2-3, FAQ p. 58): it absorbs the damage, the budget is unspent", () => {
    const s = setup(S3, true);
    const damage = s.state.instances[s.hero]!.damage;
    const hand = mustPlayer(s.state, p1).hand.length;
    const { session, events } = run(s, [use(s.attack)]);
    expect(of(events, "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: s.hero, amount: 5, reason: "tough" },
    ]);
    expect(session.state.instances[s.hero]!.statuses.tough).toBe(0);
    expect(session.state.instances[s.hero]!.damage).toBe(damage);
    // No card prevented anything, so the shield's response did not fire.
    expect(mustPlayer(session.state, p1).hand.length).toBe(hand);
  });

  it("is consumed by that attack only: the next attack without the interrupt deals its full 5", () => {
    const s = setup(null);
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s, [use(s.attack)]);
    expect(of(events, "damagePrevented")).toEqual([]);
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 5);

    // With the shield: each attack gets its own fresh budget of 3, none carries over from the last.
    const shielded = setup(S3);
    const before = shielded.state.instances[shielded.hero]!.damage;
    const first = run(shielded, [use(shielded.attack)]);
    const second = run({ ...shielded, state: first.session.state }, [use(shielded.attack)]);
    expect(of(second.events, "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: shielded.hero, amount: 3, reason: "effect" },
    ]);
    expect(second.session.state.instances[shielded.hero]!.damage).toBe(before + 4);
  });

  it("replays deep-equal", () => {
    const s = setup(S3);
    const { session } = run(s, [use(s.attack), use(s.attack)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
