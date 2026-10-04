/**
 * Piercing against damage that is dealt but not taken. RRG 1.8 "Piercing" (p. 32): "Before this attack deals damage to a
 * character, discard each tough status card from that character", except that an attack which "would deal no damage to
 * the attacked character ... does not discard tough status cards from that character". Ruling January 17, 2026 (3):
 *
 * 1. "Effects that 'prevent damage' prevent damage taken, not dealt. If Rogue plays Bulletproof Belle and gains a Tough
 *    status card, an attack with Piercing that still deals damage to her will remove that Tough status card."
 * 2. "Piercing triggers when the attack would deal damage (same window as Aerial Evacuation). However, keywords have
 *    timing priority over triggered abilities. Piercing removes the Tough status card before Aerial Evacuation triggers
 *    to prevent damage taken."
 *
 * Synthetic cards: the villain's ATK is 3, each boost card has 1 boost icon, the hero's DEF is 2 (or 9).
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
import { stubIdentity, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, HERO, runWith } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ability = (id: string, definition: AbilityDefinition) => stubAbility(id, definition);
const theVillain = { kind: "named", name: "villain" } as const;
const yourHero = { categories: ["hero"], controller: "you" } as const;
const whenAttacked = { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true } as const;
const one = { kind: "const", value: 1 } as const;

/** Shadow and Steel's shape: "When an enemy attacks you, prevent all damage from that attack." */
const PREVENT_ATTACK = ability("prevent-attack.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: whenAttacked },
  effects: [{ kind: "modifyAttack", preventAllDamage: true }],
});
/** Bulletproof Belle's shape: "… prevent all damage from that attack. Give your hero a tough status card." */
const BELLE = ability("belle.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: whenAttacked },
  effects: [
    { kind: "modifyAttack", preventAllDamage: true },
    { kind: "giveStatus", target: { kind: "identityOf", player: { kind: "controller" } }, status: "tough" },
  ],
});
/** Aerial Evacuation's shape: "When your hero would take damage, prevent all of that damage." Counts its uses. */
const EVACUATE = ability("evacuate.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: yourHero } },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "used", amount: one },
    { kind: "preventDamage" },
  ],
});
/** "When your hero would take damage, give them a tough status card." (given after piercing has resolved) */
const LATE_TOUGH = ability("late-tough.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: yourHero } },
  effects: [{ kind: "giveStatus", target: { kind: "identityOf", player: { kind: "controller" } }, status: "tough" }],
});
/** Ebony Maw's Abjuration shape: "Prevent all damage to your hero." */
const WARD = ability("ward.constant", {
  trigger: { kind: "constant", rules: [{ kind: "preventAllDamage", target: yourHero }] },
  effects: [],
});
/** "Forced Response: After a tough status card is discarded from your hero, deal 1 damage to the villain." */
const AFTER_DISCARD = ability("after-discard.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "statusDiscarded", targetIs: yourHero, eventIs: { status: "tough" } },
  },
  effects: [{ kind: "dealDamage", target: theVillain, amount: one }],
});
/** "Action: the villain attacks you." */
const ATTACK_ABILITY = ability("attack.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: { kind: "controller" } }],
});

const support = (id: string, stub: typeof ATTACK_ABILITY) => stubSupport({ id, cost: 0, abilities: [stub.ref] });
const CARDS = {
  preventAttack: support("prevent-attack", PREVENT_ATTACK),
  belle: support("belle", BELLE),
  evacuate: support("evacuate", EVACUATE),
  lateTough: support("late-tough", LATE_TOUGH),
  ward: support("ward", WARD),
  afterDiscard: support("after-discard", AFTER_DISCARD),
} as const;
const ATTACKER = support("attacker", ATTACK_ABILITY);
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });
const PIERCING: readonly KeywordInstance[] = [{ name: "piercing" }];

const deps: EngineDeps = depsOf(PREVENT_ATTACK, BELLE, EVACUATE, LATE_TOUGH, WARD, AFTER_DISCARD, ATTACK_ABILITY);

interface Options {
  readonly inPlay: readonly (keyof typeof CARDS)[];
  readonly piercing?: boolean;
  readonly tough?: number;
  readonly def?: number;
}

function setup(options: Options) {
  const villain = stubVillain({
    id: "villain",
    stages: [{ hp: flat(30), atk: 3, sch: 1, ...(options.piercing === false ? {} : { keywords: PIERCING }) }],
  });
  const scheme = stubMainScheme({
    id: "main",
    stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
  });
  const hero = stubIdentity({
    id: HERO.id,
    hp: 10,
    atk: 2,
    thw: 2,
    def: options.def ?? 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  const supports = options.inPlay.map((key) => CARDS[key]);
  let state = gameAtFirstTurn({
    cards: [hero, ...Object.values(CARDS), ATTACKER, ONE_ICON],
    deps,
    villain,
    mainScheme: scheme,
    deck: [ATTACKER.id, ...supports.map((card) => card.id)],
    encounter: copiesOf(ONE_ICON.id, 30),
  });
  const attacker = playerCardIntoPlay(state, ATTACKER.id);
  state = attacker.state;
  const placed: Record<string, InstanceId> = {};
  for (const card of supports) {
    const put = playerCardIntoPlay(state, card.id);
    state = put.state;
    placed[card.id] = put.id;
  }
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  const heroId = mustPlayer(state, P1).identity.instanceId;
  const h = state.instances[heroId]!;
  state = {
    ...state,
    instances: { ...state.instances, [heroId]: { ...h, statuses: { ...h.statuses, tough: options.tough ?? 1 } } },
  };
  return { state, attacker: attacker.id, hero: heroId, villain: activeVillain(state).instanceId, placed };
}
type Setup = ReturnType<typeof setup>;

const attack = (s: Setup): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: s.attacker,
  abilityId: ATTACK_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});
const defending =
  (hero: InstanceId) =>
  (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "declareDefender" ? [hero] : defaultPick(state);
const run = (s: Setup, pick = defaultPick) => driveSession(startSession(s.state), deps, [attack(s)], pick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const toughOf = (state: GameState, id: InstanceId) => state.instances[id]!.statuses.tough;
const damageOf = (state: GameState, id: InstanceId) => state.instances[id]!.damage;
const pierced = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "statusRemoved").filter((e) => e.instanceId === id && e.status === "tough" && e.reason === "piercing");

describe("Ruling January 17, 2026 (3) #1 on RRG 1.8 'Piercing' (p. 32): prevention is of damage taken, not dealt", () => {
  it("'prevent all damage from that attack': the piercing attack still discards the tough card, and no damage is taken", () => {
    const s = setup({ inPlay: ["preventAttack"] });
    const { session, events } = run(s);
    expect(toughOf(session.state, s.hero)).toBe(0);
    expect(pierced(events, s.hero)).toHaveLength(1);
    expect(damageOf(session.state, s.hero)).toBe(0);
    expect(of(events, "damagePrevented")).toEqual([
      { type: "damagePrevented", targetInstanceId: s.hero, amount: 4, reason: "effect" },
    ]);
    // The tough card is discarded before the damage is prevented, not after.
    const order = events.flatMap((e) => (e.type === "statusRemoved" || e.type === "damagePrevented" ? [e.type] : []));
    expect(order).toEqual(["statusRemoved", "damagePrevented"]);
  });

  it("it discards every tough status card (p. 32: 'discard each tough status card')", () => {
    const s = setup({ inPlay: ["preventAttack"], tough: 2 });
    const { session } = run(s);
    expect(toughOf(session.state, s.hero)).toBe(0);
  });

  it("Bulletproof Belle's shape: the tough card the same ability gives is the one the piercing attack discards", () => {
    const s = setup({ inPlay: ["belle"], tough: 0 });
    const { session, events } = run(s);
    expect(of(events, "statusGiven").filter((e) => e.instanceId === s.hero && e.status === "tough")).toHaveLength(1);
    expect(pierced(events, s.hero)).toHaveLength(1);
    expect(toughOf(session.state, s.hero)).toBe(0);
    expect(damageOf(session.state, s.hero)).toBe(0);
  });

  it("control: without piercing a fully prevented attack leaves the tough card (it is not what stopped the damage)", () => {
    const s = setup({ inPlay: ["preventAttack"], piercing: false });
    const { session, events } = run(s);
    expect(toughOf(session.state, s.hero)).toBe(1);
    expect(of(events, "statusRemoved")).toEqual([]);
    expect(damageOf(session.state, s.hero)).toBe(0);
  });

  it("a constant 'prevent all damage to X' is prevention too: the piercing attack discards the tough card", () => {
    const s = setup({ inPlay: ["ward"] });
    const { session, events } = run(s);
    expect(pierced(events, s.hero)).toHaveLength(1);
    expect(toughOf(session.state, s.hero)).toBe(0);
    expect(damageOf(session.state, s.hero)).toBe(0);
  });

  it("the discard is announced: 'after a tough status card is discarded' answers it though the damage was prevented", () => {
    const s = setup({ inPlay: ["preventAttack", "afterDiscard"] });
    const { session } = run(s);
    expect(toughOf(session.state, s.hero)).toBe(0);
    expect(damageOf(session.state, s.villain)).toBe(1);
  });
});

describe("RRG 1.8 'Piercing' (p. 32): an attack that would deal no damage does not discard tough status cards", () => {
  it("a basic defense whose DEF covers ATK + boost: nothing is dealt, the tough card stays", () => {
    const s = setup({ inPlay: [], def: 9 });
    const { session, events } = run(s, defending(s.hero));
    expect(of(events, "attackResolved")).toEqual([expect.objectContaining({ damageDealt: 0 })]);
    expect(toughOf(session.state, s.hero)).toBe(1);
    expect(of(events, "statusRemoved")).toEqual([]);
  });

  it("control: a basic defense that leaves damage is pierced, and the damage lands", () => {
    const s = setup({ inPlay: [] });
    const { session, events } = run(s, defending(s.hero));
    expect(pierced(events, s.hero)).toHaveLength(1);
    expect(damageOf(session.state, s.hero)).toBe(2);
  });
});

describe("Ruling January 17, 2026 (3) #2: piercing has timing priority over 'would take damage' interrupts", () => {
  it("the tough card is discarded before the interrupt prevents all of the damage", () => {
    const s = setup({ inPlay: ["evacuate"] });
    const { session, events } = run(s);
    expect(session.state.instances[s.placed[CARDS.evacuate.id]!]!.counters["used"]).toBe(1);
    expect(toughOf(session.state, s.hero)).toBe(0);
    expect(damageOf(session.state, s.hero)).toBe(0);
    const order = events.flatMap((e) => (e.type === "statusRemoved" || e.type === "damagePrevented" ? [e.type] : []));
    expect(order).toEqual(["statusRemoved", "damagePrevented"]);
  });

  it("the discard is still announced once the prevented damage has resolved", () => {
    const s = setup({ inPlay: ["evacuate", "afterDiscard"] });
    const { session } = run(s);
    expect(toughOf(session.state, s.hero)).toBe(0);
    expect(damageOf(session.state, s.villain)).toBe(1);
  });

  it("control: without piercing the tough card resolves first and the interrupt never triggers (FAQ p. 58)", () => {
    const s = setup({ inPlay: ["evacuate"], piercing: false });
    const { session, events } = run(s);
    expect(session.state.instances[s.placed[CARDS.evacuate.id]!]!.counters["used"]).toBeUndefined();
    expect(toughOf(session.state, s.hero)).toBe(0);
    expect(of(events, "statusRemoved")).toEqual([expect.objectContaining({ reason: "preventedDamage" })]);
  });

  it("piercing resolves once: a tough card an interrupt gives after it is not pierced, and absorbs the damage", () => {
    const s = setup({ inPlay: ["lateTough"] });
    const { session, events } = run(s);
    expect(of(events, "statusRemoved").map((e) => e.reason)).toEqual(["piercing", "preventedDamage"]);
    expect(toughOf(session.state, s.hero)).toBe(0);
    expect(damageOf(session.state, s.hero)).toBe(0);
  });

  it("replays to the same state", () => {
    const s = setup({ inPlay: ["evacuate", "afterDiscard"] });
    const { session } = run(s);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
