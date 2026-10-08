/**
 * Three owner rulings of 2026-10-07 on "(attack)" abilities (docs/phase7-wave8.md §4.1), built on Q47's rule in
 * `resolve/attack-ability.ts` (whose own fixtures are `attack-ability.test.ts`):
 *
 * - **Q48 = A.** Every ability labeled (attack) is an attack, whether or not it uses the hero's ATK or has an attack
 *   effect. RRG 1.8 "Labeled Ability" (p. 26): "When a player resolves an ability labeled '(attack),' that ability is
 *   considered to be an attack made by that player's identity."
 * - **Q49 = A, qualified.** Guard restricts attack targeting, not damage, and is checked for every enemy the attack
 *   targets at the time that enemy would be attacked. RRG 1.8 "Guard" (p. 21); "Attack (Player Ability Type)" (p. 10):
 *   "Hero and ally attacks can target any enemy, unless a card ability (such as guard) is preventing that enemy from
 *   being attacked."
 * - **Q50 = B, multi-target recognized.** Attacked targets are tracked apart from damage recipients. RRG 1.8 p. 10:
 *   "When an attack targets multiple enemies, the attacking character is considered to have attacked each of those
 *   enemies. Each attacked enemy with the retaliate X keyword that is still in play after the attack resolves deals
 *   its retaliate damage to the attacking character."
 *
 * - **Row 61 (rules check A1), owner decision 2026-10-08.** The attack begins as the ability begins resolving, before
 *   its first instruction. RRG 1.8 "Labeled Ability" (p. 26): "The identity of the player using the labeled ability is
 *   considered to be performing the labeled effect when the labeled ability begins resolving (after costs have been
 *   paid)." The engine's readings on top of it (opening target choices first, the target the attack begins with) are
 *   in `resolve/attack-ability.ts`.
 *
 * Synthetic cards only: every event costs 0 and the hero is the default test hero (10 hit points, ATK 2). Every play
 * is replayed from its log and compared (`play`).
 */

import { flat, type CardId, type KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern, RuleSpec } from "./abilities.js";
import { legalActions } from "./legal.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { choiceExclusions } from "./why-not.js";
import { stubEvent, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const eachMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const eachEnemy: TargetRef = { kind: "each", query: { categories: ["enemy"] } };
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const chosen = (slot: string): TargetRef => ({ kind: "slot", slot });
const marker = (name: string): TargetRef => ({ kind: "each", query: { categories: ["support"], name } });
const anEnemy = (slot = "enemy"): EffectSpec => ({
  kind: "chooseTarget",
  slot,
  query: { categories: ["enemy"] },
  chooser: { kind: "controller" },
});

const constant = (id: string, ...rules: readonly RuleSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] } satisfies AbilityDefinition);
/** "Increase the amount of damage the villain takes from each attack by 1" (the Cyclops ally's rule, in play). */
const MARKED = constant("marked.constant", {
  kind: "increaseDamageTaken",
  target: { categories: ["villain"] },
  amount: 1,
  fromAttack: true,
});
const counting = (id: string, counterType: string, on: EventPattern) =>
  stubAbility(`${id}.response`, {
    trigger: { kind: "response", forced: true, on },
    effects: [{ kind: "addCounters", target: marker(id), counterType, amount: n(1) }],
  });
/** "Forced Response: After you attack, place 1 counter here." */
const FOLLOW_UP = counting("follow-up", "attacks", { on: "attack", playerIs: "controller" });
const afterAttacking = (id: string, targetIs: TargetQuery) =>
  counting(id, "attacks", { on: "attack", playerIs: "controller", targetIs });
/** "Forced Response: After you attack a minion, place 1 counter here." */
const MINION_HUNTER = afterAttacking("minion-hunter", { categories: ["minion"] });
/** "Forced Response: After you attack the villain, place 1 counter here." */
const VILLAIN_HUNTER = afterAttacking("villain-hunter", { categories: ["villain"] });
/** "Forced Interrupt: When you attack, that attack deals 1 additional damage." */
const SHARPENED = stubAbility("sharpened.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [{ kind: "modifyAttack", extraDamage: n(1) }],
});

/** "Forced Interrupt: When you attack the villain, place 1 counter here." (an interrupt that names a target) */
const VILLAIN_WATCH = stubAbility("villain-watch.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "attack", playerIs: "controller", targetIs: { categories: ["villain"] } },
  },
  effects: [{ kind: "addCounters", target: marker("villain-watch"), counterType: "seen", amount: n(1) }],
});

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
/** A support with no text, to hold the counter an instruction places before the damage. */
const PREP_S = stubSupport({ id: "prep", cost: 0, abilities: [] });
const prepare: EffectSpec = { kind: "addCounters", target: marker("prep"), counterType: "prep", amount: n(1) };
const MARKED_S = support("marked", MARKED);
const FOLLOW_UP_S = support("follow-up", FOLLOW_UP);
const MINION_HUNTER_S = support("minion-hunter", MINION_HUNTER);
const VILLAIN_HUNTER_S = support("villain-hunter", VILLAIN_HUNTER);
const SHARPENED_S = support("sharpened", SHARPENED);
const VILLAIN_WATCH_S = support("villain-watch", VILLAIN_WATCH);
const SUPPORTS = [MARKED_S, FOLLOW_UP_S, MINION_HUNTER_S, VILLAIN_HUNTER_S, SHARPENED_S, VILLAIN_WATCH_S, PREP_S];
const PASSIVES = [MARKED, FOLLOW_UP, MINION_HUNTER, VILLAIN_HUNTER, SHARPENED, VILLAIN_WATCH];

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
const SENTRY = minion("sentry", 9, [{ name: "guard" }]);
const FRAIL_SENTRY = minion("frail-sentry", 2, [{ name: "guard" }]);
const MINIONS = [DUMMY, SPIKY, FRAIL_SPIKY, SENTRY, FRAIL_SENTRY];
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[], labeled = true) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    ...(labeled ? { label: ["attack" as const] } : {}),
    effects,
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attack = (amount: number, target: TargetRef, overkill = false): EffectSpec => ({
  kind: "attack",
  target,
  amount: n(amount),
  ...(overkill ? { overkill: true } : {}),
});
const damage = (amount: number, target: TargetRef, fromAttack?: boolean): EffectSpec => ({
  kind: "dealDamage",
  target,
  amount: n(amount),
  ...(fromAttack === undefined ? {} : { fromAttack }),
});

/** "Hero Action (attack): Deal 3 damage to the villain." No attack effect: the label alone makes it an attack. */
const JAB = event("jab", [damage(3, theVillain)]);
/** The same text with no label: plain damage. */
const LOOSE_JAB = event("loose-jab", [damage(3, theVillain)], false);
/** "Hero Action (attack): Deal 2 damage to the villain. Deal 2 damage to the villain. Deal 2 damage to the villain." */
const FLURRY = event("flurry", [damage(2, theVillain), damage(2, theVillain), damage(2, theVillain)]);
/** "Hero Action (attack): Deal 3 damage to an enemy. Confuse that enemy." */
const STRIKE = event("strike", [
  anEnemy(),
  damage(3, chosen("enemy")),
  { kind: "giveStatus", target: chosen("enemy"), status: "confused" },
]);
/** "Hero Action (attack): Deal 1 damage to each enemy." */
const BLAST = event("blast", [damage(1, eachEnemy)]);
/** "Hero Action (attack): Deal 2 damage to the villain. Deal 1 damage to each minion." */
const SPRAY = event("spray", [damage(2, theVillain), damage(1, eachMinion)]);
/** "Hero Action (attack): Take 2 damage." Nothing is attacked. */
const WINCE = event("wince", [damage(2, yourIdentity)]);
/** "Hero Action (attack): Deal 4 damage divided among enemies." */
const SCATTER = event("scatter", [
  { kind: "divide", what: "damage", amount: n(4), among: { categories: ["enemy"] }, chooser: { kind: "controller" } },
]);
/** "Hero Action (attack): Deal 2 damage to each minion. Deal 1 damage to each enemy." (an attack effect first: Q47) */
const SWEEP = event("sweep", [attack(2, eachMinion), damage(1, eachEnemy)]);
/** "Hero Action (attack): Deal 2 damage to each minion. Deal 1 damage to each enemy." (label only) */
const LABEL_SWEEP = event("label-sweep", [damage(2, eachMinion), damage(1, eachEnemy)]);
/** "Hero Action (attack): Deal 5 damage to each minion. This attack gains overkill." */
const CLEAVE = event("cleave", [attack(5, eachMinion, true)]);
/** "Hero Action (attack): Deal 3 damage to the villain. Deal 1 damage to each minion." (an attack effect first) */
const VOLLEY = event("volley", [attack(3, theVillain), damage(1, eachMinion)]);
/** An instruction the script keeps out of the attack is not an attack on the villain: guard does not stop it. */
const ASIDE = event("aside", [damage(2, eachMinion), damage(1, theVillain, false)]);
/** "Hero Action (attack): Place 1 counter on Prep. Deal 3 damage to the villain." */
const PREP_JAB = event("prep-jab", [prepare, damage(3, theVillain)]);
/** "Hero Action (attack): Choose an enemy. Place 1 counter on Prep. Deal 3 damage to that enemy." */
const AIMED = event("aimed", [anEnemy(), prepare, damage(3, chosen("enemy"))]);
/** "Hero Action (attack): Place 1 counter on Prep. Deal 2 damage to an enemy. Deal 2 damage to that enemy." */
const LATE_AIM = event("late-aim", [prepare, anEnemy(), damage(2, chosen("enemy")), damage(2, chosen("enemy"))]);
/** "Hero Action (attack): Place 1 counter on Prep. Deal 2 damage to the villain. Deal 1 damage to each minion." */
const PREP_SPRAY = event("prep-spray", [prepare, damage(2, theVillain), damage(1, eachMinion)]);
/** "Hero Action (attack): Place 1 counter on Prep. Deal 1 damage to each minion." */
const PREP_SWAT = event("prep-swat", [prepare, damage(1, eachMinion)]);
/** "Hero Action (attack): Place 1 counter on Prep. Take 2 damage." Nothing is attacked. */
const PREP_WINCE = event("prep-wince", [prepare, damage(2, yourIdentity)]);
const EVENTS = [
  PREP_JAB,
  AIMED,
  LATE_AIM,
  PREP_SPRAY,
  PREP_SWAT,
  PREP_WINCE,
  JAB,
  LOOSE_JAB,
  FLURRY,
  STRIKE,
  BLAST,
  SPRAY,
  WINCE,
  SCATTER,
  SWEEP,
  LABEL_SWEEP,
  CLEAVE,
  VOLLEY,
  ASIDE,
];

const deps: EngineDeps = depsOf(...PASSIVES, ...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly supports: readonly InstanceId[];
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
  mustPlayer(state, P1).playArea.includes(id) ||
  state.villains.some((v) => v.instanceId === id) ||
  mustInstance(state, id).engagedWith === P1;
const counters = (state: GameState, id: InstanceId, type: string): number =>
  mustInstance(state, id).counters[type] ?? 0;
const taken = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "damageDealt" ? [{ target: e.targetInstanceId, amount: e.amount }] : []));
const amountsTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  taken(events)
    .filter((d) => d.target === target)
    .map((d) => d.amount);
const dealt = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" ? [e.event] : [],
  );
const attackedIn = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked"
      ? [e.event.targetInstanceId]
      : [],
  );
const attacksOf = (events: readonly GameEvent[], phase: "initiated" | "resolved") =>
  events.flatMap((e) => (e.type === "triggerEvent" && e.phase === phase && e.event.kind === "attack" ? [e.event] : []));
const skipped = (events: readonly GameEvent[]): InstanceId[] =>
  events.flatMap((e) => (e.type === "attackTargetSkipped" ? [e.targetInstanceId] : []));
/** The cards each target choice offered, in order. */
const offered = (events: readonly GameEvent[]): InstanceId[][] =>
  events.flatMap((e) =>
    e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTarget"
      ? [e.choice.options.map((option) => option.optionId as InstanceId)]
      : [],
  );
const indexOfLast = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number =>
  events.reduce((found, e, index) => (test(e) ? index : found), -1);
/** Whether the player may play this event from hand right now. */
function playable(t: Table, card: (typeof EVENTS)[number]): boolean {
  const given = giveCard(t.state, P1, card.card.id);
  const actions = legalActions(given.state, P1, deps);
  return (
    actions.kind === "turn" &&
    actions.legal.some(({ action }) => action.kind === "playCard" && action.instanceId === given.id)
  );
}

describe("Q48: an '(attack)' ability with no attack effect is still one attack", () => {
  it("the label alone makes it an attack by the identity: one attack event, attack damage through the card", () => {
    const t = table(PLAIN_V);
    const after = play(t, JAB);
    expect(amountsTo(after.events, t.villain)).toEqual([3]);
    const [made, ...more] = attacksOf(after.events, "initiated");
    expect(more).toEqual([]);
    expect(made).toMatchObject({
      attackerInstanceId: t.hero,
      targetInstanceId: t.villain,
      labeled: true,
      basic: false,
    });
    const [instance] = dealt(after.events);
    expect(instance).toMatchObject({ fromAttack: true, sourceInstanceId: t.hero, targetInstanceId: t.villain });
    expect(instance?.viaInstanceId).not.toBe(t.hero);
    expect(instance?.parentFrameId).toBeDefined();
    const [resolved] = attacksOf(after.events, "resolved");
    expect(resolved?.results?.damage).toBe(3);
    expect(resolved?.attacked).toEqual([t.villain]);
    expect(attackedIn(after.events)).toEqual([t.villain]);
    expect(after.events.filter((e) => e.type === "attackAwaitsAbility")).toHaveLength(1);
    expect(after.state.stack).toEqual([]);
  });

  it("the same text with no label is plain damage: no attack, no 'after you attack', no retaliate, no +1 from each attack", () => {
    const t = table(THORNY_V, [MARKED_S, FOLLOW_UP_S]);
    const after = play(t, LOOSE_JAB);
    expect(amountsTo(after.events, t.villain)).toEqual([3]);
    expect(attacksOf(after.events, "initiated")).toEqual([]);
    expect(dealt(after.events)[0]?.fromAttack).toBe(false);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(0);
    expect(damageOn(after.state, t.hero)).toBe(0);
  });

  it("'after you attack' answers it, once, however many instances it deals", () => {
    const t = table(PLAIN_V, [FOLLOW_UP_S]);
    expect(counters(play(t, JAB).state, t.supports[0]!, "attacks")).toBe(1);
    const flurry = play(table(PLAIN_V, [FOLLOW_UP_S]), FLURRY);
    expect(attacksOf(flurry.events, "resolved")).toHaveLength(1);
    expect(attacksOf(flurry.events, "resolved")[0]?.results?.damage).toBe(6);
    expect(mustInstance(flurry.state, flurry.state.players[0]!.playArea[0]!).counters.attacks).toBe(1);
  });

  it("retaliate answers the completed attack once, after the last instance, never once per instance", () => {
    const t = table(THORNY_V);
    const after = play(t, FLURRY);
    expect(amountsTo(after.events, t.villain)).toEqual([2, 2, 2]);
    expect(attackedIn(after.events)).toEqual([t.villain]);
    expect(taken(after.events).map((d) => d.target)).toEqual([t.villain, t.villain, t.villain, t.hero]);
    expect(damageOn(after.state, t.hero)).toBe(1);
  });

  it("'increase the damage that enemy takes from each attack by 1' applies to each instance (2 + 2 + 2 becomes 3 + 3 + 3)", () => {
    const t = table(PLAIN_V, [MARKED_S]);
    const after = play(t, FLURRY);
    expect(amountsTo(after.events, t.villain)).toEqual([3, 3, 3]);
    expect(dealt(after.events).map((d) => d.fromAttack)).toEqual([true, true, true]);
    expect(new Set(dealt(after.events).map((d) => d.parentFrameId)).size).toBe(1);
  });

  it("'that attack deals 1 additional damage' is added to each instance of a label-only attack (RRG 1.8 p. 10)", () => {
    const t = table(PLAIN_V, [SHARPENED_S]);
    const after = play(t, FLURRY);
    expect(amountsTo(after.events, t.villain)).toEqual([3, 3, 3]);
  });

  it("a division of damage is one attack on each enemy given a share", () => {
    const t = table(THORNY_V, [FOLLOW_UP_S], [SPIKY]);
    // Every point on the first candidate offered unless the test picks: the default pick takes the first option.
    const after = play(t, SCATTER);
    expect(attacksOf(after.events, "resolved")).toHaveLength(1);
    expect(counters(after.state, t.supports[0]!, "attacks")).toBe(1);
    const shares = dealt(after.events).filter((d) => d.targetInstanceId !== t.hero);
    expect(shares.length).toBeGreaterThan(0);
    expect(shares.every((d) => d.fromAttack && d.sourceInstanceId === t.hero)).toBe(true);
    // Each enemy given a share was attacked (and may retaliate), and no other.
    expect(attackedIn(after.events)).toEqual([...new Set(shares.map((d) => d.targetInstanceId))]);
  });

  it("an ability whose only damage is to its player's own character attacks nothing: no attack event, plain damage", () => {
    const t = table(THORNY_V, [FOLLOW_UP_S]);
    const after = play(t, WINCE);
    expect(amountsTo(after.events, t.hero)).toEqual([2]);
    expect(attacksOf(after.events, "initiated")).toEqual([]);
    expect(dealt(after.events)[0]).toMatchObject({ fromAttack: false });
    expect(counters(after.state, t.supports[0]!, "attacks")).toBe(0);
  });
});

describe("Row 61 (A1): a label-only attack begins as its ability begins resolving (RRG 1.8 p. 26)", () => {
  const at = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number => events.findIndex(test);
  const begins = (e: GameEvent) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack";
  const prepared = (e: GameEvent) => e.type === "counterAdded" && e.counterType === "prep";
  const chose = (e: GameEvent) => e.type === "targetChosen";
  const firstDamage = (e: GameEvent) => e.type === "damageDealt";

  it("an instruction written before the damage resolves after the attack has begun, and its window with it", () => {
    const t = table(PLAIN_V, [PREP_S, SHARPENED_S, VILLAIN_WATCH_S]);
    const after = play(t, PREP_JAB);
    expect(at(after.events, begins)).toBeGreaterThanOrEqual(0);
    expect(at(after.events, begins)).toBeLessThan(at(after.events, prepared));
    expect(at(after.events, prepared)).toBeLessThan(at(after.events, firstDamage));
    // The window opened before the counter: "when you attack" added its 1 (3 + 1), once.
    expect(amountsTo(after.events, t.villain)).toEqual([4]);
    expect(attacksOf(after.events, "initiated")).toHaveLength(1);
    // Read ahead as it began: the enemy its first damage instruction names is the attack's target.
    expect(attacksOf(after.events, "initiated")[0]).toMatchObject({ targetInstanceId: t.villain, labeled: true });
    expect(counters(after.state, t.supports[2]!, "seen")).toBe(1);
    expect(counters(after.state, t.supports[0]!, "prep")).toBe(1);
    expect(after.state.stack).toEqual([]);
  });

  it("a target choice that opens the ability is made first: the attack begins against the chosen enemy", () => {
    const t = table(PLAIN_V, [PREP_S, VILLAIN_WATCH_S, MINION_HUNTER_S]);
    const after = play(t, AIMED);
    expect(at(after.events, chose)).toBeLessThan(at(after.events, begins));
    expect(at(after.events, begins)).toBeLessThan(at(after.events, prepared));
    const [picked] = offered(after.events)[0]!;
    expect(attacksOf(after.events, "initiated")[0]?.targetInstanceId).toBe(picked);
    // The default pick is the villain: the interrupt that names it hears the attack.
    expect(picked).toBe(t.villain);
    expect(counters(after.state, t.supports[1]!, "seen")).toBe(1);
    expect(amountsTo(after.events, t.villain)).toEqual([3]);
  });

  it("an enemy chosen after an earlier instruction: the attack begins with no target and takes the first enemy attacked", () => {
    const t = table(THORNY_V, [PREP_S, SHARPENED_S, VILLAIN_WATCH_S, VILLAIN_HUNTER_S, FOLLOW_UP_S]);
    const after = play(t, LATE_AIM);
    expect(at(after.events, begins)).toBeLessThan(at(after.events, prepared));
    expect(at(after.events, prepared)).toBeLessThan(at(after.events, chose));
    expect(attacksOf(after.events, "initiated")).toHaveLength(1);
    expect(attacksOf(after.events, "initiated")[0]).toMatchObject({ targetInstanceId: null, labeled: true });
    // An interrupt that asks nothing of the target heard it (2 + 1, each instance); one that names the villain did not.
    expect(amountsTo(after.events, t.villain)).toEqual([3, 3]);
    expect(counters(after.state, t.supports[2]!, "seen")).toBe(0);
    // It is still one attack on the villain: its target from then on, one retaliate, "after you attack the villain".
    const [resolved, ...more] = attacksOf(after.events, "resolved");
    expect(more).toEqual([]);
    expect(resolved).toMatchObject({ targetInstanceId: t.villain, attacked: [t.villain] });
    expect(attackedIn(after.events)).toEqual([t.villain]);
    expect(amountsTo(after.events, t.hero)).toEqual([1]);
    expect(counters(after.state, t.supports[3]!, "attacks")).toBe(1);
    expect(counters(after.state, t.supports[4]!, "attacks")).toBe(1);
  });

  it("the target it begins with is an enemy it may attack: past a guarded villain, the minion the next instruction names", () => {
    const t = table(THORNY_V, [PREP_S, VILLAIN_WATCH_S], [SENTRY]);
    const after = play(t, PREP_SPRAY);
    expect(at(after.events, begins)).toBeLessThan(at(after.events, prepared));
    expect(attacksOf(after.events, "initiated")[0]?.targetInstanceId).toBe(t.minions[0]!);
    expect(counters(after.state, t.supports[1]!, "seen")).toBe(0);
    // Guard is still read for each enemy as it would be attacked (Q49): the villain is skipped and does not retaliate.
    expect(skipped(after.events)).toEqual([t.villain]);
    expect(amountsTo(after.events, t.villain)).toEqual([]);
    expect(attackedIn(after.events)).toEqual([t.minions[0]!]);
    expect(damageOn(after.state, t.hero)).toBe(0);
  });

  it("an attack that begins and then finds no enemy to attack attacked nobody: no retaliate, no 'after you attack the villain'", () => {
    const t = table(THORNY_V, [PREP_S, SHARPENED_S, FOLLOW_UP_S, VILLAIN_HUNTER_S, MINION_HUNTER_S]);
    const after = play(t, PREP_SWAT);
    expect(attacksOf(after.events, "initiated")).toHaveLength(1);
    expect(attacksOf(after.events, "initiated")[0]?.targetInstanceId).toBeNull();
    expect(at(after.events, begins)).toBeLessThan(at(after.events, prepared));
    expect(taken(after.events)).toEqual([]);
    expect(attackedIn(after.events)).toEqual([]);
    expect(attacksOf(after.events, "resolved")[0]).toMatchObject({ targetInstanceId: null, attacked: [] });
    // The identity made an attack (p. 26), so "after you attack" answers; the clauses that name an enemy do not.
    expect(counters(after.state, t.supports[2]!, "attacks")).toBe(1);
    expect(counters(after.state, t.supports[3]!, "attacks")).toBe(0);
    expect(counters(after.state, t.supports[4]!, "attacks")).toBe(0);
    expect(after.state.stack).toEqual([]);
  });

  it("an ability that can only damage its player's own character still begins no attack, whatever comes first", () => {
    const t = table(THORNY_V, [PREP_S, FOLLOW_UP_S]);
    const after = play(t, PREP_WINCE);
    expect(attacksOf(after.events, "initiated")).toEqual([]);
    expect(amountsTo(after.events, t.hero)).toEqual([2]);
    expect(counters(after.state, t.supports[0]!, "prep")).toBe(1);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(0);
  });

  it("an ability with nothing before its damage is unchanged: the attack begins at that instruction, against its enemy", () => {
    const t = table(PLAIN_V, [VILLAIN_WATCH_S]);
    const after = play(t, STRIKE);
    expect(at(after.events, chose)).toBeLessThan(at(after.events, begins));
    expect(at(after.events, begins)).toBeLessThan(at(after.events, firstDamage));
    expect(attacksOf(after.events, "initiated")[0]?.targetInstanceId).toBe(offered(after.events)[0]![0]);
  });
});

describe("Q49: guard is checked for each enemy an attack targets, as it would be attacked", () => {
  it("a chosen-target instruction does not offer the guarded villain, whatever else the ability does to its target", () => {
    const t = table(PLAIN_V, [], [SENTRY]);
    const after = play(t, STRIKE);
    expect(offered(after.events)).toEqual([[t.minions[0]!]]);
    expect(amountsTo(after.events, t.villain)).toEqual([]);
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([3]);
    // While that choice is open, "why not the villain?" has an answer (`choiceExclusions`).
    const given = giveCard(t.state, P1, STRIKE.card.id);
    const asked = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!asked.ok) throw new Error(asked.error.message);
    expect(asked.state.pendingChoice?.prompt.kind).toBe("chooseTarget");
    expect(choiceExclusions(asked.state, deps)).toContainEqual({ instanceId: t.villain, reason: "cannotBeAttacked" });
    // With no guard minion the villain is offered too.
    const open = table(PLAIN_V, [], [DUMMY]);
    expect(offered(play(open, STRIKE).events)[0]).toContain(open.villain);
  });

  it("an attack ability that names only the guarded villain cannot be played; without the label it can", () => {
    const guarded = table(PLAIN_V, [], [SENTRY]);
    expect(playable(guarded, JAB)).toBe(false);
    expect(playable(guarded, LOOSE_JAB)).toBe(true);
    expect(playable(table(PLAIN_V, [], [DUMMY]), JAB)).toBe(true);
  });

  it("'each enemy' skips the guarded villain and attacks the rest (label only)", () => {
    const t = table(THORNY_V, [], [SENTRY]);
    const after = play(t, BLAST);
    expect(amountsTo(after.events, t.villain)).toEqual([]);
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([1]);
    expect(skipped(after.events)).toEqual([t.villain]);
    // The villain was not attacked: no retaliate, and the resolved attack does not name it.
    expect(attackedIn(after.events)).toEqual([t.minions[0]!]);
    expect(attacksOf(after.events, "resolved")[0]?.attacked).toEqual([t.minions[0]!]);
    expect(damageOn(after.state, t.hero)).toBe(0);
  });

  it("a later instruction of the attack does not reach the villain past a guard minion still engaged", () => {
    for (const card of [SWEEP, LABEL_SWEEP]) {
      const t = table(THORNY_V, [], [SENTRY]);
      const after = play(t, card);
      // 2 to the guard minion (9 hit points), then "each enemy": 1 more to it, none to the villain it still guards.
      expect(amountsTo(after.events, t.minions[0]!)).toEqual([2, 1]);
      expect(amountsTo(after.events, t.villain)).toEqual([]);
      expect(skipped(after.events)).toEqual([t.villain]);
      expect(attackedIn(after.events)).toEqual([t.minions[0]!]);
      expect(damageOn(after.state, t.hero)).toBe(0);
    }
  });

  it("a guard minion an earlier instruction defeated no longer guards: the next instruction attacks the villain", () => {
    for (const card of [SWEEP, LABEL_SWEEP]) {
      const t = table(THORNY_V, [], [FRAIL_SENTRY]);
      const after = play(t, card);
      expect(inPlay(after.state, t.minions[0]!)).toBe(false);
      expect(amountsTo(after.events, t.villain)).toEqual([1]);
      expect(skipped(after.events)).toEqual([]);
      // The villain was attacked, and retaliates once the attack has finished.
      expect(attackedIn(after.events)).toEqual([t.minions[0]!, t.villain]);
      expect(amountsTo(after.events, t.hero)).toEqual([1]);
    }
  });

  it("with every enemy an instruction names guarded, a label-only attack is not made and the damage is not dealt", () => {
    const t = table(THORNY_V, [FOLLOW_UP_S], [SENTRY]);
    // Not playable at all (every instruction names the villain alone).
    expect(playable(t, FLURRY)).toBe(false);
    // An ability with another part still resolves it: the minions' instruction, with the villain's skipped.
    const spray = play(t, SPRAY);
    expect(amountsTo(spray.events, t.villain)).toEqual([]);
    expect(amountsTo(spray.events, t.minions[0]!)).toEqual([1]);
    expect(attackedIn(spray.events)).toEqual([t.minions[0]!]);
    expect(counters(spray.state, t.supports[0]!, "attacks")).toBe(1);
  });

  it("guard does not stop damage that is not an attack on the villain: an unlabeled ability, an instruction kept out of the attack", () => {
    const t = table(PLAIN_V, [], [SENTRY]);
    expect(amountsTo(play(t, LOOSE_JAB).events, t.villain)).toEqual([3]);
    const aside = play(table(PLAIN_V, [], [SENTRY]), ASIDE);
    expect(amountsTo(aside.events, aside.state.villains[0]!.instanceId)).toEqual([1]);
    expect(skipped(aside.events)).toEqual([]);
  });

  it("a division of damage does not offer the guarded villain", () => {
    const t = table(PLAIN_V, [], [SENTRY]);
    const after = play(t, SCATTER);
    expect(amountsTo(after.events, t.villain)).toEqual([]);
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([4]);
  });
});

describe("Q50: attacked targets are tracked apart from damage recipients", () => {
  it("an enemy that only takes the attack's overkill spill is not attacked: no retaliate, no 'after you attack the villain'", () => {
    const t = table(THORNY_V, [VILLAIN_HUNTER_S, MINION_HUNTER_S], [FRAIL_SPIKY]);
    const after = play(t, CLEAVE);
    // 5 to a 3 hit point minion with overkill: 2 spill onto the villain, guard or no guard.
    expect(inPlay(after.state, t.minions[0]!)).toBe(false);
    expect(amountsTo(after.events, t.villain)).toEqual([2]);
    expect(attackedIn(after.events)).toEqual([t.minions[0]!]);
    expect(attacksOf(after.events, "resolved")[0]?.attacked).toBeUndefined();
    expect(damageOn(after.state, t.hero)).toBe(0);
    expect(counters(after.state, t.supports[0]!, "attacks")).toBe(0);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(1);
  });

  it("overkill reaches the villain past a guard minion: the spill is not an attack on it", () => {
    const t = table(THORNY_V, [], [FRAIL_SENTRY]);
    const after = play(t, CLEAVE);
    expect(amountsTo(after.events, t.villain)).toEqual([3]);
    expect(skipped(after.events)).toEqual([]);
    expect(attackedIn(after.events)).toEqual([t.minions[0]!]);
    expect(damageOn(after.state, t.hero)).toBe(0);
  });

  it("'after you attack a minion' answers for a minion only a later instruction named, once per attack", () => {
    for (const card of [VOLLEY, SPRAY]) {
      const t = table(PLAIN_V, [MINION_HUNTER_S, VILLAIN_HUNTER_S], [DUMMY, SPIKY]);
      const after = play(t, card);
      expect(attacksOf(after.events, "resolved")[0]?.attacked).toEqual([t.villain, t.minions[0]!, t.minions[1]!]);
      expect(counters(after.state, t.supports[0]!, "attacks")).toBe(1);
      expect(counters(after.state, t.supports[1]!, "attacks")).toBe(1);
      // With no minion in play, nothing answers "a minion".
      const alone = table(PLAIN_V, [MINION_HUNTER_S]);
      expect(counters(play(alone, card).state, alone.supports[0]!, "attacks")).toBe(0);
    }
  });

  it("each targeted enemy can retaliate, after the whole attack, in the order attacked", () => {
    const t = table(THORNY_V, [], [SPIKY]);
    const after = play(t, SPRAY);
    expect(attackedIn(after.events)).toEqual([t.villain, t.minions[0]!]);
    expect(amountsTo(after.events, t.hero)).toEqual([1, 2]);
    const lastToEnemy = indexOfLast(after.events, (e) => e.type === "damageDealt" && e.targetInstanceId !== t.hero);
    const firstToHero = after.events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === t.hero);
    expect(firstToHero).toBeGreaterThan(lastToEnemy);
  });
});
