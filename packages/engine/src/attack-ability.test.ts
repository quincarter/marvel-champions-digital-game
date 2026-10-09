/**
 * One "(attack)" ability is one attack (`resolve/attack-ability.ts`). Owner ruling, 2026-10-07, docs/phase7-wave8.md
 * §4.1 Q47, following FFG's ruling on the Cyclops ally (Q46: 2 + 2 + 2 + 2 becomes 3 + 3 + 3 + 3):
 *
 *   An event or ability with the (attack) label is one attack. Damage it deals to enemies while resolving is damage
 *   from that attack, even when separate instructions deal it or it goes to different enemies. Kept distinct:
 *   1. retaliate triggers once per surviving enemy attacked, not once per instance of damage;
 *   2. "after this attack" effects resolve after the whole ability, its further damage included;
 *   3. several instances against one enemy each take the modifiers that apply;
 *   4. damage the ability deals to the attacking identity is not attack damage dealt to an enemy.
 *
 * RRG 1.8 "Attack (Player Ability Type)" (p. 10): "An ability labeled as an attack is considered a single attack, even
 * if that attack deals multiple instances of damage"; "When an attack targets multiple enemies, the attacking character
 * is considered to have attacked each of those enemies. Each attacked enemy with the retaliate X keyword that is still
 * in play after the attack resolves deals its retaliate damage to the attacking character"; step 7, forced abilities
 * (retaliate) with "after [character] attacks …" and "after [character] is attacked …", then step 8.
 *
 * Synthetic cards only: every event costs 0 and the hero is the default test hero (10 hit points, ATK 2).
 */

import { flat, type CardId, type KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const eachMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const eachEnemy: TargetRef = { kind: "each", query: { categories: ["enemy"] } };
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const aVillain: TargetQuery = { categories: ["villain"] };
const marker = (name: string): TargetRef => ({ kind: "each", query: { categories: ["support"], name } });

const constant = (id: string, ...rules: readonly RuleSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] } satisfies AbilityDefinition);
/** "Increase the amount of damage the villain takes from each attack by 1" (the Cyclops ally's rule, in play). */
const MARKED = constant("marked.constant", {
  kind: "increaseDamageTaken",
  target: aVillain,
  amount: 1,
  fromAttack: true,
});
/** The same on each minion, to tell the villain's instances from another enemy's. */
const MARKED_MINIONS = constant("marked-minions.constant", {
  kind: "increaseDamageTaken",
  target: { categories: ["minion"] },
  amount: 1,
  fromAttack: true,
});
/** "Increase the amount of damage your identity takes from each attack by 1": must not reach an ability's own damage. */
const EXPOSED = constant("exposed.constant", {
  kind: "increaseDamageTaken",
  target: { categories: ["identity"] },
  amount: 1,
  fromAttack: true,
});
/** A different card: "Forced Response: After the villain is dealt damage by an attack, deal 1 damage to the villain." */
const ECHO = stubAbility("echo.response", {
  trigger: { kind: "response", forced: true, on: { on: "dealDamage", targetIs: aVillain, fromAttack: true } },
  effects: [{ kind: "dealDamage", target: theVillain, amount: n(1) }],
});
/** "Forced Interrupt: When you attack, at the end of this attack place 1 counter here." */
const AFTERMATH = stubAbility("aftermath.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [
    {
      kind: "atEndOfAttack",
      effects: [{ kind: "addCounters", target: marker("aftermath"), counterType: "ended", amount: n(1) }],
    },
  ],
});
/** "Forced Response: After you attack, place 1 counter here." */
const FOLLOW_UP = stubAbility("follow-up.response", {
  trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [{ kind: "addCounters", target: marker("follow-up"), counterType: "attacks", amount: n(1) }],
});
/** "Forced Response: After you attack and defeat an enemy, place 1 counter here." */
const TROPHY = stubAbility("trophy.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "attack", playerIs: "controller", requireResults: { defeated: 1 } },
  },
  effects: [{ kind: "addCounters", target: marker("trophy"), counterType: "defeats", amount: n(1) }],
});

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const MARKED_S = support("marked", MARKED);
const MARKED_MINIONS_S = support("marked-minions", MARKED_MINIONS);
const EXPOSED_S = support("exposed", EXPOSED);
const ECHO_S = support("echo", ECHO);
const AFTERMATH_S = support("aftermath", AFTERMATH);
const FOLLOW_UP_S = support("follow-up", FOLLOW_UP);
const TROPHY_S = support("trophy", TROPHY);
const SUPPORTS = [MARKED_S, MARKED_MINIONS_S, EXPOSED_S, ECHO_S, AFTERMATH_S, FOLLOW_UP_S, TROPHY_S];

const villain = (id: string, keywords: readonly KeywordInstance[] = []) =>
  stubVillain({ id, stages: [{ hp: flat(40), atk: 2, sch: 1, keywords }] });
const PLAIN_V = villain("plain-villain");
const THORNY_V = villain("thorny-villain", [{ name: "retaliate", value: 1 }]);
const VILLAINS = [PLAIN_V, THORNY_V];

const minion = (id: string, hp: number, keywords: readonly KeywordInstance[] = []) =>
  stubMinion({ id, atk: 1, sch: 1, boostIcons: 0, hp, keywords });
const DUMMY = minion("dummy", 9);
const SPIKY = minion("spiky", 9, [{ name: "retaliate", value: 2 }]);
const FRAIL_SPIKY = minion("frail-spiky", 3, [{ name: "retaliate", value: 2 }]);
const MINIONS = [DUMMY, SPIKY, FRAIL_SPIKY];
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[], labeled = true) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    ...(labeled ? { label: ["attack" as const] } : {}),
    effects,
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attack = (amount: number, target: TargetRef, bind?: string): EffectSpec => ({
  kind: "attack",
  target,
  amount: n(amount),
  ...(bind ? { bind } : {}),
});
const damage = (amount: number, target: TargetRef, fromAttack?: boolean): EffectSpec => ({
  kind: "dealDamage",
  target,
  amount: n(amount),
  ...(fromAttack === undefined ? {} : { fromAttack }),
});
const VOLLEY_EFFECTS = [attack(2, theVillain), damage(2, theVillain), damage(2, theVillain)];
/** "Hero Action (attack): Deal 2 damage to the villain. Deal 2 damage to the villain. Deal 2 damage to the villain." */
const VOLLEY = event("volley", VOLLEY_EFFECTS);
/** The same text with no label: three separate things, only the first an attack. */
const LOOSE_VOLLEY = event("loose-volley", VOLLEY_EFFECTS, false);
/** "Hero Action (attack): Deal 3 damage to the villain. Deal 1 damage to each minion." */
const SWEEP = event("sweep", [attack(3, theVillain), damage(1, eachMinion)]);
/** "Hero Action (attack): Deal 1 damage to the villain. Deal 1 damage to each enemy." (the villain twice) */
const BURST = event("burst", [attack(1, theVillain), damage(1, eachEnemy)]);
/** "Hero Action (attack): Deal 2 damage to a minion. Deal 2 damage to each minion." */
const DOUBLE_TAP = event("double-tap", [attack(2, eachMinion), damage(2, eachMinion)]);
/** "Hero Action (attack): Deal 2 damage to the villain. Take 2 damage." */
const RECKLESS = event("reckless", [attack(2, theVillain), damage(2, yourIdentity)]);
/** An instruction the script keeps out of the attack (`fromAttack: false`). */
const ASIDE = event("aside", [attack(2, theVillain), damage(2, theVillain, false)]);
/** The attack's own results are read by the next instruction, as before: "deal damage equal to the damage dealt". */
const ECHOING = event("echoing", [
  attack(2, theVillain, "hit"),
  { kind: "dealDamage", target: theVillain, amount: { kind: "var", name: "hit.damage" } },
]);
const EVENTS = [VOLLEY, LOOSE_VOLLEY, SWEEP, BURST, DOUBLE_TAP, RECKLESS, ASIDE, ECHOING];

const deps: EngineDeps = depsOf(
  MARKED,
  MARKED_MINIONS,
  EXPOSED,
  ECHO,
  AFTERMATH,
  FOLLOW_UP,
  TROPHY,
  ...EVENTS.map((e) => e.ability),
);

interface Table {
  readonly state: GameState;
  /** The supports put into play, in the order asked. */
  readonly supports: readonly InstanceId[];
  /** The minions engaged, in the order asked. */
  readonly minions: readonly InstanceId[];
  readonly hero: InstanceId;
  readonly villain: InstanceId;
}

/** Hero form, `inPlay` under the player's control, `engaged` minions engaged with them, blank boost cards. */
function table(
  v: (typeof VILLAINS)[number],
  inPlay: readonly (typeof SUPPORTS)[number][] = [],
  engaged: readonly (typeof MINIONS)[number][] = [],
): Table {
  const playerCards = [...SUPPORTS, ...EVENTS.map((e) => e.card)];
  const base = gameAtFirstTurn({
    cards: [...VILLAINS, ...MINIONS, BLANK, ...playerCards],
    deps,
    villain: v,
    encounter: [...MINIONS.flatMap((m) => copiesOf(m.id, 2)), ...copiesOf(BLANK.id, 20)],
    deck: playerCards.flatMap((c) => copiesOf(c.id as CardId, 2)),
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const supports: InstanceId[] = [];
  for (const card of inPlay) {
    const placed = playerCardIntoPlay(state, card.id);
    state = placed.state;
    supports.push(placed.id);
  }
  const minions: InstanceId[] = [];
  for (const card of engaged) {
    const placed = minionEngagedWith(state, card.id);
    state = placed.state;
    minions.push(placed.id);
  }
  return {
    state,
    supports,
    minions,
    hero: mustPlayer(state, P1).identity.instanceId,
    villain: state.villains[0]!.instanceId,
  };
}

/** Plays the event for 0 and checks the session's log replays to the same state (deep-equal). */
function play(t: Table, card: (typeof EVENTS)[number]) {
  const result = playFree(t.state, deps, card.card.id);
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return result;
}

const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const inPlay = (state: GameState, id: InstanceId): boolean =>
  mustPlayer(state, P1).playArea.includes(id) || state.villains.some((v) => v.instanceId === id);
const counters = (state: GameState, id: InstanceId, type: string): number =>
  mustInstance(state, id).counters[type] ?? 0;
/** Every instance of damage taken, in order: who took it and how much. */
const taken = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "damageDealt" ? [{ target: e.targetInstanceId, amount: e.amount }] : []));
const amountsTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  taken(events)
    .filter((d) => d.target === target)
    .map((d) => d.amount);
/** The `dealDamage` events as they were initiated, for what each one says about itself. */
const dealt = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" ? [e.event] : [],
  );
/** The `characterAttacked` events that resolved: one per character attacked. */
const attackedIn = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked"
      ? [e.event.targetInstanceId]
      : [],
  );
/** The resolved `attack` events, with their results. */
const attacksResolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
  );
const indexOfLast = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number =>
  events.reduce((found, e, index) => (test(e) ? index : found), -1);

describe("Q47: damage an '(attack)' ability deals to enemies is damage from that attack", () => {
  it("every instruction's damage to the attacked enemy is attack damage dealt by the attacker, through the card", () => {
    const t = table(PLAIN_V);
    const after = play(t, VOLLEY);
    expect(amountsTo(after.events, t.villain)).toEqual([2, 2, 2]);
    const instances = dealt(after.events).filter((d) => d.targetInstanceId === t.villain);
    expect(instances.map((d) => d.fromAttack)).toEqual([true, true, true]);
    expect(instances.map((d) => d.sourceInstanceId)).toEqual([t.hero, t.hero, t.hero]);
    // All three belong to the one attack event, and are made through the same card (the event).
    expect(new Set(instances.map((d) => d.parentFrameId)).size).toBe(1);
    expect(new Set(instances.map((d) => d.viaInstanceId)).size).toBe(1);
    expect(instances[0]!.viaInstanceId).not.toBe(t.hero);
  });

  it("distinction 3: 'increase the damage that enemy takes from each attack by 1' applies to each instance (2 + 2 + 2 becomes 3 + 3 + 3 = 9)", () => {
    const t = table(PLAIN_V, [MARKED_S]);
    const after = play(t, VOLLEY);
    expect(amountsTo(after.events, t.villain)).toEqual([3, 3, 3]);
    expect(damageOn(after.state, t.villain)).toBe(9);
  });

  it("damage to other enemies is the attack's too: the rule on minions adds 1 to each minion's instance, none to the villain's", () => {
    const t = table(PLAIN_V, [MARKED_MINIONS_S], [DUMMY, SPIKY]);
    const after = play(t, SWEEP);
    expect(amountsTo(after.events, t.villain)).toEqual([3]);
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([2]);
    expect(amountsTo(after.events, t.minions[1]!)).toEqual([2]);
    // With the rule on the villain instead, only the villain's instance grows.
    const other = table(PLAIN_V, [MARKED_S], [DUMMY]);
    const second = play(other, SWEEP);
    expect(amountsTo(second.events, other.villain)).toEqual([4]);
    expect(amountsTo(second.events, other.minions[0]!)).toEqual([1]);
  });

  it("the attack's results count every instance: its resolved event reports 6 damage, and the instruction after the first reads the first's own", () => {
    const t = table(PLAIN_V);
    const after = play(t, VOLLEY);
    const [resolved, ...rest] = attacksResolved(after.events);
    expect(rest).toEqual([]);
    expect(resolved?.results?.damage).toBe(6);
    // `<bind>.damage` is reported as the first instance resolves: the second instruction deals that much again.
    const echoing = play(table(PLAIN_V), ECHOING);
    expect(taken(echoing.events).map((d) => d.amount)).toEqual([2, 2]);
  });

  it("an enemy defeated by a later instruction is defeated by the attack: 'after you attack and defeat an enemy' answers", () => {
    const t = table(PLAIN_V, [TROPHY_S], [FRAIL_SPIKY]);
    const after = play(t, DOUBLE_TAP);
    // 2 from the attack, then 2 more: 3 hit points, defeated by the second instruction.
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([2, 2]);
    expect(inPlay(after.state, t.minions[0]!)).toBe(false);
    expect(counters(after.state, t.supports[0]!, "defeats")).toBe(1);
    expect(attacksResolved(after.events)[0]?.results?.defeated).toBe(1);
  });
});

describe("Q47 distinction 1: retaliate once per surviving enemy attacked", () => {
  it("the same enemy hit three times retaliates once, after the last instance", () => {
    const t = table(THORNY_V);
    const after = play(t, VOLLEY);
    expect(amountsTo(after.events, t.villain)).toEqual([2, 2, 2]);
    expect(attackedIn(after.events)).toEqual([t.villain]);
    expect(amountsTo(after.events, t.hero)).toEqual([1]);
    expect(damageOn(after.state, t.hero)).toBe(1);
    expect(taken(after.events).map((d) => d.target)).toEqual([t.villain, t.villain, t.villain, t.hero]);
  });

  it("the same enemy named by the attack and again by 'each enemy' is attacked once", () => {
    const t = table(THORNY_V);
    const after = play(t, BURST);
    expect(amountsTo(after.events, t.villain)).toEqual([1, 1]);
    expect(attackedIn(after.events)).toEqual([t.villain]);
    expect(damageOn(after.state, t.hero)).toBe(1);
  });

  it("two enemies hit: two retaliates, one each; an enemy only a later instruction damaged was attacked", () => {
    const t = table(THORNY_V, [], [SPIKY]);
    const after = play(t, SWEEP);
    expect(attackedIn(after.events)).toEqual([t.villain, t.minions[0]!]);
    // Retaliate 1 from the villain, retaliate 2 from the minion the second instruction damaged.
    expect(amountsTo(after.events, t.hero)).toEqual([1, 2]);
    expect(damageOn(after.state, t.hero)).toBe(3);
  });

  it("an enemy the attack defeated does not retaliate, though it survived the first instance", () => {
    const t = table(PLAIN_V, [], [FRAIL_SPIKY]);
    const after = play(t, DOUBLE_TAP);
    expect(inPlay(after.state, t.minions[0]!)).toBe(false);
    expect(amountsTo(after.events, t.hero)).toEqual([]);
    expect(damageOn(after.state, t.hero)).toBe(0);
  });

  it("a surviving enemy beside a defeated one: only the survivor retaliates", () => {
    const t = table(PLAIN_V, [], [FRAIL_SPIKY, SPIKY]);
    const after = play(t, DOUBLE_TAP);
    expect(inPlay(after.state, t.minions[0]!)).toBe(false);
    expect(damageOn(after.state, t.minions[1]!)).toBe(4);
    expect(amountsTo(after.events, t.hero)).toEqual([2]);
  });
});

describe("Q47 distinction 2: what follows the attack follows the whole ability", () => {
  it("'at the end of this attack' resolves after the last instruction's damage", () => {
    const t = table(PLAIN_V, [AFTERMATH_S]);
    const after = play(t, VOLLEY);
    expect(counters(after.state, t.supports[0]!, "ended")).toBe(1);
    const lastDamage = indexOfLast(after.events, (e) => e.type === "damageDealt");
    const ended = indexOfLast(after.events, (e) => e.type === "counterAdded");
    expect(lastDamage).toBeGreaterThan(-1);
    expect(ended).toBeGreaterThan(lastDamage);
    expect(amountsTo(after.events, t.villain)).toEqual([2, 2, 2]);
  });

  it("'after you attack' answers once, after the last instruction and after retaliate", () => {
    const t = table(THORNY_V, [FOLLOW_UP_S]);
    const after = play(t, VOLLEY);
    expect(counters(after.state, t.supports[0]!, "attacks")).toBe(1);
    const retaliated = indexOfLast(after.events, (e) => e.type === "damageDealt" && e.targetInstanceId === t.hero);
    const answered = indexOfLast(after.events, (e) => e.type === "counterAdded");
    expect(retaliated).toBeGreaterThan(
      indexOfLast(after.events, (e) => e.type === "damageDealt" && e.targetInstanceId === t.villain),
    );
    expect(answered).toBeGreaterThan(retaliated);
  });

  it("the attack is logged as waiting for its ability, once", () => {
    const t = table(PLAIN_V);
    const after = play(t, VOLLEY);
    const waits = after.events.filter((e) => e.type === "attackAwaitsAbility");
    expect(waits).toHaveLength(1);
    expect(waits[0]).toMatchObject({ attackerInstanceId: t.hero });
    expect(after.state.stack).toEqual([]);
  });
});

describe("Q47 distinction 4 and the rule's edges: what is not the attack's damage", () => {
  it("damage the ability deals to the attacking identity is not attack damage: 2 taken, no '+1 from each attack'", () => {
    const t = table(PLAIN_V, [EXPOSED_S]);
    const after = play(t, RECKLESS);
    expect(amountsTo(after.events, t.villain)).toEqual([2]);
    expect(amountsTo(after.events, t.hero)).toEqual([2]);
    const self = dealt(after.events).find((d) => d.targetInstanceId === t.hero);
    expect(self?.fromAttack).toBe(false);
    expect(self?.parentFrameId).toBeUndefined();
    // The hero is not "attacked" by its own ability.
    expect(attackedIn(after.events)).toEqual([t.villain]);
    expect(attacksResolved(after.events)[0]?.results?.damage).toBe(2);
  });

  it("an ability with no attack label is unchanged: only its attack effect is an attack (3 + 2 + 2), and retaliate follows that effect", () => {
    const t = table(PLAIN_V, [MARKED_S]);
    const after = play(t, LOOSE_VOLLEY);
    expect(amountsTo(after.events, t.villain)).toEqual([3, 2, 2]);
    expect(after.events.some((e) => e.type === "attackAwaitsAbility")).toBe(false);
    const thorny = table(THORNY_V);
    const second = play(thorny, LOOSE_VOLLEY);
    expect(taken(second.events).map((d) => d.target)).toEqual([
      thorny.villain,
      thorny.hero,
      thorny.villain,
      thorny.villain,
    ]);
    expect(attackedIn(second.events)).toEqual([thorny.villain]);
  });

  it("damage another card's response deals during the attack is not part of it: 1 each time, never 2", () => {
    const t = table(PLAIN_V, [MARKED_S, ECHO_S]);
    const after = play(t, VOLLEY);
    // Each of the three instances is 3 (attack damage, +1) and is answered by 1 plain damage from the other card.
    expect(amountsTo(after.events, t.villain)).toEqual([3, 1, 3, 1, 3, 1]);
    const echoes = dealt(after.events).filter((d) => d.sourceInstanceId === t.supports[1]);
    expect(echoes).toHaveLength(3);
    expect(echoes.every((d) => d.fromAttack === false && d.parentFrameId === undefined)).toBe(true);
    expect(attacksResolved(after.events)[0]?.results?.damage).toBe(9);
  });

  it("`fromAttack: false` keeps one instruction out of the attack: 3 + 2", () => {
    const t = table(PLAIN_V, [MARKED_S]);
    const after = play(t, ASIDE);
    expect(amountsTo(after.events, t.villain)).toEqual([3, 2]);
    expect(attacksResolved(after.events)[0]?.results?.damage).toBe(3);
  });
});
