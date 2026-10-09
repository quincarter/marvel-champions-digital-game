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
 * - **Row 73 (rules check A1, second half), owner decision 2026-10-08.** An ability with an `attack` effect begins
 *   its attack the same way: when another instruction resolves before that effect, the attack and its window open
 *   before that instruction, and the effect deals the damage of the attack already begun. Same sentence of p. 26.
 *   The readings on top of it (what is read ahead, several attacks, a stun received meanwhile) are interpretations,
 *   stated with their alternatives in `resolve/attack-ability.ts`.
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

/** "Forced Interrupt: When you make a ranged attack, place 1 counter here." */
const RANGE_WATCH = stubAbility("range-watch.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller", attackHas: ["ranged"] } },
  effects: [{ kind: "addCounters", target: marker("range-watch"), counterType: "seen", amount: n(1) }],
});

/** "Forced Interrupt: When you attack, cancel that attack. Place 1 counter here." */
const PARRY = stubAbility("parry.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller" } },
  effects: [
    { kind: "cancelTriggeringEvent" },
    { kind: "addCounters", target: marker("parry"), counterType: "cancelled", amount: n(1) },
  ],
});
/** "Forced Interrupt: When you attack the villain, cancel that attack." (an attack on a minion is let through) */
const VILLAIN_PARRY = stubAbility("villain-parry.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "attack", playerIs: "controller", targetIs: { categories: ["villain"] } },
  },
  effects: [{ kind: "cancelTriggeringEvent" }],
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
const RANGE_WATCH_S = support("range-watch", RANGE_WATCH);
const PARRY_S = support("parry", PARRY);
const VILLAIN_PARRY_S = support("villain-parry", VILLAIN_PARRY);
const SUPPORTS = [
  MARKED_S,
  FOLLOW_UP_S,
  MINION_HUNTER_S,
  VILLAIN_HUNTER_S,
  SHARPENED_S,
  VILLAIN_WATCH_S,
  RANGE_WATCH_S,
  PREP_S,
  PARRY_S,
  VILLAIN_PARRY_S,
];
const PASSIVES = [
  MARKED,
  FOLLOW_UP,
  MINION_HUNTER,
  VILLAIN_HUNTER,
  SHARPENED,
  VILLAIN_WATCH,
  RANGE_WATCH,
  PARRY,
  VILLAIN_PARRY,
];

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
/** "Hero Action (attack): Place 1 counter on Prep. Deal 3 damage to the villain." (with an attack effect) */
const PREP_HIT = event("prep-hit", [prepare, attack(3, theVillain)]);
/** "Hero Action (attack): Place 1 counter on Prep. Then, deal 3 damage to the villain." */
const PREP_THEN_JAB = event("prep-then-jab", [prepare, { kind: "then", effects: [damage(3, theVillain)] }]);
/** "Hero Action (attack): Place 1 counter on Prep. If Prep has a counter on it, deal 3 damage to the villain." */
const PREP_MAYBE_JAB = event("prep-maybe-jab", [
  prepare,
  {
    kind: "if",
    condition: {
      kind: "compare",
      left: { kind: "counters", of: marker("prep"), counterType: "prep" },
      op: "atLeast",
      right: n(1),
    },
    then: [damage(3, theVillain)],
  },
]);
/** "Hero Action (attack): Place 1 counter on Prep. Deal 3 damage to the villain." (the damage kept out of the attack) */
const PREP_ASIDE = event("prep-aside", [prepare, damage(3, theVillain, false)]);
/** "Hero Action (attack): Deal 3 damage to the villain. Take 2 damage. Place 1 counter on Prep." */
const RECKLESS = event("reckless", [damage(3, theVillain), damage(2, yourIdentity), prepare]);
/** "Hero Action (attack): Deal 3 damage to the villain. Then, place 1 counter on Prep." */
const JAB_THEN_PREP = event("jab-then-prep", [damage(3, theVillain), { kind: "then", effects: [prepare] }]);
/** "Hero Action (attack): Deal 2 damage to each minion. Deal 3 damage to the villain. Deal 1 damage to each minion." */
const ONE_TWO = event("one-two", [attack(2, eachMinion), attack(3, theVillain), damage(1, eachMinion)]);
/** "Hero Action (attack): Deal 3 damage to the villain." twice over, as two attack effects. */
const DOUBLE_HIT = event("double-hit", [attack(3, theVillain), attack(3, theVillain)]);
const prepHas = (atLeast: number) =>
  ({
    kind: "compare",
    left: { kind: "counters", of: marker("prep"), counterType: "prep" },
    op: "atLeast",
    right: n(atLeast),
  }) as const;
/** "Hero Action (attack): Place 1 counter on Prep. Deal 3 damage to the villain. Place 1 counter on Prep. Deal 3 …" */
const PREP_DOUBLE = event("prep-double", [prepare, attack(3, theVillain), prepare, attack(3, theVillain)]);
/** "Hero Action (attack): Place 1 counter on Prep. Choose an enemy. Deal 3 damage to that enemy." (attack effect) */
const PREP_AIM_HIT = event("prep-aim-hit", [prepare, anEnemy(), attack(3, chosen("enemy"))]);
/** "Hero Action (attack): Deal 1 damage to each minion. Deal 3 damage to an enemy." (damage, then an attack effect) */
const STOMP = event("stomp", [damage(1, eachMinion), anEnemy(), attack(3, chosen("enemy"))]);
/** "Hero Action (attack): Place 1 counter on Prep. Deal 2 damage to each minion." (attack effect) */
const PREP_SWEEP = event("prep-sweep", [prepare, attack(2, eachMinion)]);
/** A branch already decided as the ability begins (always true): "…Place 1 counter on Prep. If …, deal 3 damage…". */
const PREP_SURE_HIT = event("prep-sure-hit", [
  prepare,
  { kind: "if", condition: prepHas(0), then: [attack(3, theVillain)] },
]);
/** A branch decided by the instruction before it: not known as the ability begins. */
const PREP_MAYBE_HIT = event("prep-maybe-hit", [
  prepare,
  { kind: "if", condition: prepHas(1), then: [attack(3, theVillain)] },
]);
/** A branch never taken. */
const PREP_NEVER_HIT = event("prep-never-hit", [
  prepare,
  { kind: "if", condition: prepHas(5), then: [attack(3, theVillain)] },
]);
/** The label-only twin of PREP_SURE_HIT: a damage instruction in a branch already decided. */
const PREP_SURE_JAB = event("prep-sure-jab", [
  prepare,
  { kind: "if", condition: prepHas(0), then: [damage(3, theVillain)] },
]);
/** "Hero Action (attack): Choose one: place 1 counter on Prep and deal 2 damage to the villain, or … deal 3 damage." */
const PREP_EITHER = event("prep-either", [
  {
    kind: "chooseOne",
    chooser: { kind: "controller" },
    options: [
      { label: "two", effects: [prepare, attack(2, theVillain)] },
      { label: "three", effects: [prepare, attack(3, theVillain)] },
    ],
  },
]);
/** "Hero Action (attack): Choose one: place 1 counter on Prep, or deal 3 damage to the villain." */
const PREP_OR_HIT = event("prep-or-hit", [
  prepare,
  {
    kind: "chooseOne",
    chooser: { kind: "controller" },
    options: [
      { label: "hit", effects: [attack(3, theVillain)] },
      { label: "prep", effects: [prepare] },
    ],
  },
]);
/** "Hero Action (attack): You are stunned. Deal 3 damage to the villain." */
const DAZED_HIT = event("dazed-hit", [
  { kind: "giveStatus", target: yourIdentity, status: "stunned" },
  attack(3, theVillain),
]);
/** "Hero Action (attack): Place 1 counter on Prep. Deal 3 damage to the villain. This attack gains ranged." */
const PREP_SHOT: ReturnType<typeof event> = event("prep-shot", [
  prepare,
  { kind: "attack", target: theVillain, amount: n(3), keywords: ["ranged"] },
]);
const EVENTS = [
  PREP_DOUBLE,
  PREP_AIM_HIT,
  STOMP,
  PREP_SWEEP,
  PREP_SURE_HIT,
  PREP_MAYBE_HIT,
  PREP_NEVER_HIT,
  PREP_SURE_JAB,
  PREP_EITHER,
  PREP_OR_HIT,
  DAZED_HIT,
  PREP_SHOT,
  RECKLESS,
  JAB_THEN_PREP,
  ONE_TWO,
  DOUBLE_HIT,
  PREP_HIT,
  PREP_THEN_JAB,
  PREP_MAYBE_JAB,
  PREP_ASIDE,
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

describe("Row 73 (A1, second half): an ability with an attack effect begins its attack as it begins resolving", () => {
  // Official rule, RRG 1.8 "Labeled Ability" (p. 26): "The identity of the player using the labeled ability is
  // considered to be performing the labeled effect when the labeled ability begins resolving (after costs have been
  // paid)." Owner decision, 2026-10-08: the attack of an ability that makes an ATK attack after an earlier instruction
  // begins then too. Each test marked "interpretation" checks a reading stated in `resolve/attack-ability.ts`.
  const at = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number => events.findIndex(test);
  const indexes = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number[] =>
    events.flatMap((e, index) => (test(e) ? [index] : []));
  const begins = (e: GameEvent) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "attack";
  const prepared = (e: GameEvent) => e.type === "counterAdded" && e.counterType === "prep";
  const chose = (e: GameEvent) => e.type === "targetChosen";
  const anyDamage = (e: GameEvent) => e.type === "damageDealt";
  const stunnedTable = (t: Table): Table => {
    const hero = mustInstance(t.state, t.hero);
    return {
      ...t,
      state: {
        ...t.state,
        instances: { ...t.state.instances, [t.hero]: { ...hero, statuses: { ...hero.statuses, stunned: 1 } } },
      },
    };
  };

  it("an earlier instruction resolves inside the attack: begun, then the counter, then the damage; one event, one window", () => {
    const t = table(THORNY_V, [PREP_S, FOLLOW_UP_S, VILLAIN_HUNTER_S]);
    const after = play(t, PREP_HIT);
    expect(at(after.events, begins)).toBeGreaterThanOrEqual(0);
    expect(at(after.events, begins)).toBeLessThan(at(after.events, prepared));
    expect(at(after.events, prepared)).toBeLessThan(at(after.events, anyDamage));
    // One attack event. As it begins it is marked, names the enemy its attack instruction names and has no amount.
    const [made, ...more] = attacksOf(after.events, "initiated");
    expect(more).toEqual([]);
    expect(made).toMatchObject({ begun: true, targetInstanceId: t.villain, amount: 0, attackerInstanceId: t.hero });
    expect(made?.labeled).toBeUndefined();
    // The instruction took that event over: it resolves as any attack does (its amount, its one target, no list).
    const [resolved, ...others] = attacksOf(after.events, "resolved");
    expect(others).toEqual([]);
    expect(resolved).toMatchObject({ targetInstanceId: t.villain, amount: 3 });
    expect(resolved?.results?.damage).toBe(3);
    expect(resolved?.attacked).toBeUndefined();
    const [instance] = dealt(after.events);
    expect(instance).toMatchObject({ fromAttack: true, sourceInstanceId: t.hero, targetInstanceId: t.villain });
    // The same frame deals the damage: it waited beneath the ability twice (as it began, after its damage).
    const waits = after.events.flatMap((e) => (e.type === "attackAwaitsAbility" ? [e.attackFrameId] : []));
    expect(waits).toHaveLength(2);
    expect(new Set(waits).size).toBe(1);
    expect(instance?.parentFrameId).toBe(waits[0]);
    // Retaliate and "after you attack [the villain]" follow the ability's last instruction, once.
    expect(amountsTo(after.events, t.villain)).toEqual([3]);
    expect(attackedIn(after.events)).toEqual([t.villain]);
    expect(amountsTo(after.events, t.hero)).toEqual([1]);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(1);
    expect(counters(after.state, t.supports[2]!, "attacks")).toBe(1);
    expect(counters(after.state, t.supports[0]!, "prep")).toBe(1);
    expect(after.state.stack).toEqual([]);
  });

  it("'when you attack' fires before the earlier instruction, and what it gives the attack reaches the later damage", () => {
    const t = table(PLAIN_V, [PREP_S, SHARPENED_S, VILLAIN_WATCH_S]);
    const after = play(t, PREP_HIT);
    const answered = at(after.events, (e) => e.type === "counterAdded" && e.counterType === "seen");
    expect(answered).toBeGreaterThanOrEqual(0);
    expect(answered).toBeLessThan(at(after.events, prepared));
    // "That attack deals 1 additional damage", given in the window before the counter: 3 + 1 when the damage resolves.
    expect(amountsTo(after.events, t.villain)).toEqual([4]);
    // Each interrupt answered once: the instruction opened no second window.
    expect(counters(after.state, t.supports[2]!, "seen")).toBe(1);
    expect(attacksOf(after.events, "initiated")).toHaveLength(1);
  });

  it("the window hears the attack instruction's keywords: 'when you make a ranged attack'", () => {
    const t = table(PLAIN_V, [PREP_S, RANGE_WATCH_S]);
    const shot = play(t, PREP_SHOT);
    expect(attacksOf(shot.events, "initiated")[0]).toMatchObject({ begun: true, keywords: ["ranged"] });
    expect(counters(shot.state, t.supports[1]!, "seen")).toBe(1);
    expect(dealt(shot.events)[0]).toMatchObject({ ranged: true });
    // An attack that is not ranged is not heard.
    const plain = table(PLAIN_V, [PREP_S, RANGE_WATCH_S]);
    expect(counters(play(plain, PREP_HIT).state, plain.supports[1]!, "seen")).toBe(0);
  });

  it("an enemy chosen after the earlier instruction: the attack begins with no target, and an interrupt that names one does not hear it", () => {
    const t = table(THORNY_V, [PREP_S, SHARPENED_S, VILLAIN_WATCH_S, VILLAIN_HUNTER_S]);
    const after = play(t, PREP_AIM_HIT);
    expect(at(after.events, begins)).toBeLessThan(at(after.events, prepared));
    expect(at(after.events, prepared)).toBeLessThan(at(after.events, chose));
    expect(attacksOf(after.events, "initiated")).toHaveLength(1);
    expect(attacksOf(after.events, "initiated")[0]).toMatchObject({ begun: true, targetInstanceId: null });
    expect(counters(after.state, t.supports[2]!, "seen")).toBe(0);
    // An interrupt that asks nothing of the target heard it: 3 + 1. The attack is on the villain from then on.
    expect(amountsTo(after.events, t.villain)).toEqual([4]);
    expect(attacksOf(after.events, "resolved")[0]).toMatchObject({ targetInstanceId: t.villain });
    expect(attackedIn(after.events)).toEqual([t.villain]);
    expect(amountsTo(after.events, t.hero)).toEqual([1]);
    expect(counters(after.state, t.supports[3]!, "attacks")).toBe(1);
  });

  it("a stunned identity: the whole ability is cancelled as it begins and the stunned card discarded (RRG 1.8 pp. 26, 41)", () => {
    // P. 26: "If a player triggers a labeled ability while their identity has one or more status cards that cancel any
    // of the labeled ability types, the entire ability (except for its costs) is canceled". P. 41: "If a stunned
    // identity or ally attempts to attack or use an attack ability, discard the stunned card instead."
    const t = stunnedTable(table(PLAIN_V, [PREP_S, FOLLOW_UP_S]));
    const after = play(t, PREP_HIT);
    expect(mustInstance(after.state, t.hero).statuses.stunned).toBe(0);
    expect(attacksOf(after.events, "initiated")).toEqual([]);
    expect(taken(after.events)).toEqual([]);
    // The earlier instruction is part of the cancelled ability: no counter.
    expect(counters(after.state, t.supports[0]!, "prep")).toBe(0);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(0);
  });

  it("interpretation: a stunned card received after the attack began does not replace it, and stays", () => {
    const t = table(PLAIN_V);
    const after = play(t, DAZED_HIT);
    const stunnedAt = at(after.events, (e) => e.type === "statusGiven");
    expect(at(after.events, begins)).toBeGreaterThanOrEqual(0);
    expect(at(after.events, begins)).toBeLessThan(stunnedAt);
    expect(after.events.some((e) => e.type === "statusRemoved")).toBe(false);
    expect(amountsTo(after.events, t.villain)).toEqual([3]);
    expect(mustInstance(after.state, t.hero).statuses.stunned).toBe(1);
  });

  it("a cancel in the window that opened early: the earlier instruction still resolves, the attack instruction deals nothing (row 65)", () => {
    const t = table(THORNY_V, [PREP_S, PARRY_S, FOLLOW_UP_S]);
    const after = play(t, PREP_HIT);
    expect(counters(after.state, t.supports[1]!, "cancelled")).toBe(1);
    expect(counters(after.state, t.supports[0]!, "prep")).toBe(1);
    expect(taken(after.events)).toEqual([]);
    expect(skipped(after.events)).toEqual([t.villain]);
    expect(attacksOf(after.events, "resolved")).toEqual([]);
    expect(counters(after.state, t.supports[2]!, "attacks")).toBe(0);
    expect(after.state.stack).toEqual([]);
  });

  it("interpretation: an ability with two attacks: the first begins with the ability, the second as its instruction is reached", () => {
    const t = table(THORNY_V, [PREP_S, SHARPENED_S, FOLLOW_UP_S]);
    const after = play(t, PREP_DOUBLE);
    const [firstBegins, secondBegins, ...moreBegins] = indexes(after.events, begins);
    const [firstPrep, secondPrep] = indexes(after.events, prepared);
    const [firstDamage, secondDamage] = indexes(
      after.events,
      (e) => e.type === "damageDealt" && e.targetInstanceId === t.villain,
    );
    expect(moreBegins).toEqual([]);
    expect(firstBegins!).toBeLessThan(firstPrep!);
    expect(firstPrep!).toBeLessThan(firstDamage!);
    expect(firstDamage!).toBeLessThan(secondPrep!);
    expect(secondPrep!).toBeLessThan(secondBegins!);
    expect(secondBegins!).toBeLessThan(secondDamage!);
    const [first, second] = attacksOf(after.events, "initiated");
    expect(first?.begun).toBe(true);
    expect(second?.begun).toBeUndefined();
    // Each attack has its own window: "that attack deals 1 additional damage" reaches each once (RRG 1.8 p. 10).
    expect(amountsTo(after.events, t.villain)).toEqual([4, 4]);
    // Two attacks: two "after you attack", and the villain retaliates against each, after the ability.
    expect(attacksOf(after.events, "resolved")).toHaveLength(2);
    expect(counters(after.state, t.supports[2]!, "attacks")).toBe(2);
    expect(amountsTo(after.events, t.hero)).toEqual([1, 1]);
    expect(counters(after.state, t.supports[0]!, "prep")).toBe(2);
    expect(after.state.stack).toEqual([]);
  });

  it("an ability whose attack instruction resolves first is unchanged: no early event, the window at that instruction", () => {
    for (const card of [VOLLEY, DOUBLE_HIT, ONE_TWO]) {
      const after = play(table(PLAIN_V, [], [DUMMY]), card);
      expect(attacksOf(after.events, "initiated").some((made) => made.begun)).toBe(false);
    }
  });

  it("an attack inside a branch that is not taken makes no attack", () => {
    const t = table(THORNY_V, [PREP_S, FOLLOW_UP_S, SHARPENED_S]);
    const after = play(t, PREP_NEVER_HIT);
    expect(attacksOf(after.events, "initiated")).toEqual([]);
    expect(taken(after.events)).toEqual([]);
    expect(counters(after.state, t.supports[0]!, "prep")).toBe(1);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(0);
  });

  it("interpretation: a branch already decided as the ability begins is read: its attack begins with the ability", () => {
    for (const card of [PREP_SURE_HIT, PREP_SURE_JAB]) {
      const t = table(PLAIN_V, [PREP_S, SHARPENED_S]);
      const after = play(t, card);
      expect(at(after.events, begins)).toBeGreaterThanOrEqual(0);
      expect(at(after.events, begins)).toBeLessThan(at(after.events, prepared));
      expect(attacksOf(after.events, "initiated")).toHaveLength(1);
      expect(amountsTo(after.events, t.villain)).toEqual([4]);
    }
  });

  it("interpretation: a branch the earlier instruction decides is not read: its attack begins as it is reached", () => {
    const t = table(PLAIN_V, [PREP_S, SHARPENED_S]);
    const after = play(t, PREP_MAYBE_HIT);
    expect(at(after.events, prepared)).toBeLessThan(at(after.events, begins));
    expect(attacksOf(after.events, "initiated")).toHaveLength(1);
    expect(attacksOf(after.events, "initiated")[0]?.begun).toBeUndefined();
    expect(amountsTo(after.events, t.villain)).toEqual([4]);
  });

  it("interpretation: a choice begins the attack early only when every option makes one", () => {
    const t = table(PLAIN_V, [PREP_S, SHARPENED_S]);
    const either = play(t, PREP_EITHER);
    expect(at(either.events, begins)).toBeLessThan(at(either.events, prepared));
    expect(attacksOf(either.events, "initiated")).toHaveLength(1);
    expect(attacksOf(either.events, "initiated")[0]).toMatchObject({ begun: true, targetInstanceId: t.villain });
    // The first option is the default pick: 2 + 1.
    expect(amountsTo(either.events, t.villain)).toEqual([3]);
    // One option does not attack: nothing begins until the option chosen reaches its attack instruction.
    const maybe = table(PLAIN_V, [PREP_S, SHARPENED_S]);
    const orHit = play(maybe, PREP_OR_HIT);
    expect(at(orHit.events, prepared)).toBeLessThan(at(orHit.events, begins));
    expect(attacksOf(orHit.events, "initiated")[0]?.begun).toBeUndefined();
    expect(amountsTo(orHit.events, maybe.villain)).toEqual([4]);
  });

  it("damage written before the attack instruction is that attack's: attack damage, each enemy attacked, one retaliate each", () => {
    const t = table(PLAIN_V, [SHARPENED_S, MINION_HUNTER_S, VILLAIN_HUNTER_S], [SPIKY]);
    const after = play(t, STOMP);
    const [made, ...more] = attacksOf(after.events, "initiated");
    expect(more).toEqual([]);
    // It begins before the first damage, against the first enemy an instruction names: the minion.
    expect(made).toMatchObject({ begun: true, targetInstanceId: t.minions[0]! });
    expect(at(after.events, begins)).toBeLessThan(at(after.events, anyDamage));
    // 1 + 1 to the minion, then 3 + 1 to the enemy chosen (the villain, the default pick): each instance increased.
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([2]);
    expect(amountsTo(after.events, t.villain)).toEqual([4]);
    expect(
      dealt(after.events)
        .filter((d) => d.targetInstanceId !== t.hero)
        .map((d) => d.fromAttack),
    ).toEqual([true, true]);
    const [resolved] = attacksOf(after.events, "resolved");
    expect(resolved).toMatchObject({ targetInstanceId: t.villain, attacked: [t.minions[0]!, t.villain] });
    expect(attackedIn(after.events)).toEqual([t.minions[0]!, t.villain]);
    // The minion retaliates once, after the whole ability.
    expect(amountsTo(after.events, t.hero)).toEqual([2]);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(1);
    expect(counters(after.state, t.supports[2]!, "attacks")).toBe(1);
  });

  it("interpretation: an attack instruction naming several enemies: the begun attack is the first, the others get their own event", () => {
    const t = table(PLAIN_V, [PREP_S, SHARPENED_S], [DUMMY, SPIKY]);
    const after = play(t, PREP_SWEEP);
    const made = attacksOf(after.events, "initiated");
    expect(made.map((attack) => attack.begun === true)).toEqual([true, false]);
    expect(made.map((attack) => attack.targetInstanceId)).toEqual(t.minions);
    expect(indexes(after.events, begins)[0]!).toBeLessThan(at(after.events, prepared));
    expect(at(after.events, prepared)).toBeLessThan(indexes(after.events, begins)[1]!);
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([3]);
    expect(amountsTo(after.events, t.minions[1]!)).toEqual([3]);
    expect(after.state.stack).toEqual([]);
  });

  it("an attack that began and finds no enemy to attack at its instruction attacked nobody", () => {
    // "Each minion" with none in play: the attack began (p. 26), its instruction names nobody.
    const t = table(THORNY_V, [PREP_S, FOLLOW_UP_S, VILLAIN_HUNTER_S, MINION_HUNTER_S]);
    const after = play(t, PREP_SWEEP);
    expect(attacksOf(after.events, "initiated")).toHaveLength(1);
    expect(attacksOf(after.events, "initiated")[0]).toMatchObject({ begun: true, targetInstanceId: null });
    expect(taken(after.events)).toEqual([]);
    expect(attacksOf(after.events, "resolved")[0]).toMatchObject({ targetInstanceId: null, attacked: [] });
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(1);
    expect(counters(after.state, t.supports[2]!, "attacks")).toBe(0);
    expect(counters(after.state, t.supports[3]!, "attacks")).toBe(0);
    expect(after.state.stack).toEqual([]);
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

describe("Row 64 (A4): an '(attack)' ability whose attack names only an enemy it may not attack cannot be initiated", () => {
  // Owner decision, 2026-10-08, on RRG 1.8 "Target" (p. 43): "A target that cannot be attacked is not a valid target
  // for an attack-labeled ability." Its other instruction (the counter on Prep) does not make it playable.
  it("with another instruction before its damage to the guarded villain it is not playable, and the play is refused unpaid", () => {
    const guarded = table(PLAIN_V, [PREP_S], [SENTRY]);
    for (const card of [PREP_JAB, PREP_HIT, PREP_THEN_JAB, FLURRY, JAB]) expect(playable(guarded, card)).toBe(false);
    const given = giveCard(guarded.state, P1, PREP_JAB.card.id);
    const refused = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    expect(refused.ok).toBe(false);
    // The reason a villain-only attack already gave ("Deal 3 damage to the villain" alone).
    if (!refused.ok)
      expect(refused.error).toMatchObject({ code: "no_valid_target", message: "this event has no valid target" });
  });

  it("with no guard minion, or a minion that does not guard, each is playable and deals its damage", () => {
    for (const engaged of [[], [DUMMY]]) {
      for (const card of [PREP_JAB, PREP_HIT, PREP_THEN_JAB]) {
        const t = table(PLAIN_V, [PREP_S], engaged);
        expect(playable(t, card)).toBe(true);
        expect(amountsTo(play(t, card).events, t.villain)).toEqual([3]);
      }
    }
  });

  it("an ability with another enemy it may attack stays playable: the guarded villain is skipped as it resolves (Q49)", () => {
    for (const card of [PREP_SPRAY, SPRAY, BLAST, STRIKE, SCATTER, VOLLEY]) {
      expect(playable(table(PLAIN_V, [PREP_S], [SENTRY]), card)).toBe(true);
    }
    const t = table(PLAIN_V, [PREP_S], [SENTRY]);
    const after = play(t, PREP_SPRAY);
    expect(skipped(after.events)).toEqual([t.villain]);
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([1]);
  });

  it("nothing is refused on a guess: damage inside a branch, damage kept out of the attack, no label", () => {
    const guarded = table(PLAIN_V, [PREP_S], [SENTRY]);
    // A branch may not be taken, so the ability may resolve without attacking; as it resolves the villain is skipped.
    expect(playable(guarded, PREP_MAYBE_JAB)).toBe(true);
    const maybe = play(guarded, PREP_MAYBE_JAB);
    expect(amountsTo(maybe.events, guarded.villain)).toEqual([]);
    expect(skipped(maybe.events)).toEqual([guarded.villain]);
    expect(counters(maybe.state, guarded.supports[0]!, "prep")).toBe(1);
    // Damage that is not the attack's is not an attack on the villain: guard does not stop it.
    expect(playable(guarded, PREP_ASIDE)).toBe(true);
    expect(playable(guarded, LOOSE_JAB)).toBe(true);
    // An attack that names no enemy in play is not judged (as before): "each minion" with none engaged.
    expect(playable(table(PLAIN_V, [PREP_S]), PREP_SWAT)).toBe(true);
  });

  it("a stunned hero may still attempt it (RRG 1.8 'Stun, Stunned', p. 41): the stunned card is discarded instead", () => {
    const guarded = table(PLAIN_V, [PREP_S], [SENTRY]);
    const hero = mustInstance(guarded.state, guarded.hero);
    const stunned: Table = {
      ...guarded,
      state: {
        ...guarded.state,
        instances: {
          ...guarded.state.instances,
          [guarded.hero]: { ...hero, statuses: { ...hero.statuses, stunned: 1 } },
        },
      },
    };
    expect(playable(stunned, PREP_JAB)).toBe(true);
    const after = play(stunned, PREP_JAB);
    expect(mustInstance(after.state, stunned.hero).statuses.stunned).toBe(0);
    expect(amountsTo(after.events, stunned.villain)).toEqual([]);
    expect(counters(after.state, stunned.supports[0]!, "prep")).toBe(0);
  });
});

describe("Row 65 (A6): a cancelled '(attack)' ability's attack deals no damage", () => {
  // Owner decision, 2026-10-08: "cancelling a damage-only attack cancels its damage too". RRG 1.8 "Cancel" (p. 11):
  // "Cancel effects are considered a subtype of replacement effect, with the canceled effect being replaced with no
  // effect"; "Attack (Player Ability Type)" (p. 10): "An ability labeled as an attack is considered a single attack,
  // even if that attack deals multiple instances of damage."
  const cancelledAttacks = (events: readonly GameEvent[]) =>
    events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "cancelled" && e.event.kind === "attack" ? [e.event] : [],
    );
  const cancelSkips = (events: readonly GameEvent[]): InstanceId[] =>
    events.flatMap((e) =>
      e.type === "attackTargetSkipped" && e.reason === "attackCancelled" ? [e.targetInstanceId] : [],
    );
  const discarded = (state: GameState, card: (typeof EVENTS)[number]): boolean =>
    mustPlayer(state, P1).discard.some((id) => mustInstance(state, id).cardId === card.card.id);

  it("a label-only attack: its one instance is not dealt, nothing retaliates, nothing answers 'after you attack'", () => {
    const t = table(THORNY_V, [PARRY_S, FOLLOW_UP_S, VILLAIN_HUNTER_S]);
    const after = play(t, JAB);
    expect(taken(after.events)).toEqual([]);
    expect(cancelledAttacks(after.events)).toHaveLength(1);
    expect(attacksOf(after.events, "resolved")).toEqual([]);
    expect(cancelSkips(after.events)).toEqual([t.villain]);
    expect(attackedIn(after.events)).toEqual([]);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(0);
    expect(counters(after.state, t.supports[2]!, "attacks")).toBe(0);
    // The event was still played: its cost stays paid and it is discarded (RRG 1.8 "Cancel", p. 11).
    expect(discarded(after.state, JAB)).toBe(true);
    expect(after.state.stack).toEqual([]);
  });

  it("every instance of the one attack goes: three sentences, 'each enemy', a division", () => {
    const flurry = table(PLAIN_V, [PARRY_S]);
    const three = play(flurry, FLURRY);
    expect(taken(three.events)).toEqual([]);
    expect(cancelSkips(three.events)).toEqual([flurry.villain, flurry.villain, flurry.villain]);
    // One attack, one window: the interrupt answered once.
    expect(counters(three.state, flurry.supports[0]!, "cancelled")).toBe(1);

    const spread = table(PLAIN_V, [PARRY_S], [DUMMY, SPIKY]);
    const blast = play(spread, BLAST);
    expect(taken(blast.events)).toEqual([]);
    expect(cancelSkips(blast.events)).toEqual([spread.villain, ...spread.minions]);

    const scatter = play(table(PLAIN_V, [PARRY_S], [DUMMY]), SCATTER);
    expect(taken(scatter.events)).toEqual([]);
    expect(scatter.events.some((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "divide")).toBe(false);
  });

  it("interpretation: the ability's other instructions still resolve (a status, damage its player takes, a counter)", () => {
    const strike = table(PLAIN_V, [PARRY_S]);
    const struck = play(strike, STRIKE);
    expect(taken(struck.events)).toEqual([]);
    expect(mustInstance(struck.state, strike.villain).statuses.confused).toBe(1);

    const reckless = table(PLAIN_V, [PARRY_S, PREP_S]);
    const after = play(reckless, RECKLESS);
    expect(taken(after.events)).toEqual([{ target: reckless.hero, amount: 2 }]);
    expect(counters(after.state, reckless.supports[1]!, "prep")).toBe(1);

    // Damage the script keeps out of the attack is not the attack's, so it is not cancelled with it.
    const kept = table(PLAIN_V, [PARRY_S], [DUMMY]);
    const aside = play(kept, ASIDE);
    expect(amountsTo(aside.events, kept.minions[0]!)).toEqual([]);
    expect(amountsTo(aside.events, kept.villain)).toEqual([1]);
  });

  it("post-'then' text does not resolve after a cancelled instruction (RRG 1.8 \"'Then'\", p. 44)", () => {
    const t = table(PLAIN_V, [PARRY_S, PREP_S]);
    const after = play(t, JAB_THEN_PREP);
    expect(taken(after.events)).toEqual([]);
    expect(after.events).toContainEqual({ type: "preThenUnresolved", cause: "attackCancelled" });
    expect(after.events.some((e) => e.type === "thenSkipped")).toBe(true);
    expect(counters(after.state, t.supports[1]!, "prep")).toBe(0);
    // Not cancelled: the counter is placed.
    const open = table(PLAIN_V, [PREP_S]);
    expect(counters(play(open, JAB_THEN_PREP).state, open.supports[0]!, "prep")).toBe(1);
  });

  it("an ability with an attack effect: its later damage instructions are not dealt as plain damage", () => {
    const t = table(THORNY_V, [PARRY_S, FOLLOW_UP_S], [DUMMY]);
    const after = play(t, VOLLEY);
    expect(taken(after.events)).toEqual([]);
    expect(cancelSkips(after.events)).toEqual([t.minions[0]!]);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(0);
    expect(after.state.stack).toEqual([]);
  });

  it("its remaining attack effects are cancelled with it, with no window of their own", () => {
    // "Each minion": two attack events from one effect. The first is cancelled in its window, the second with it.
    const sweep = table(PLAIN_V, [PARRY_S], [DUMMY, SPIKY]);
    const swept = play(sweep, SWEEP);
    expect(taken(swept.events)).toEqual([]);
    expect(cancelledAttacks(swept.events)).toHaveLength(2);
    expect(counters(swept.state, sweep.supports[0]!, "cancelled")).toBe(1);
    // A second attack effect, not yet reached, makes no event.
    const twice = table(PLAIN_V, [PARRY_S]);
    const hit = play(twice, DOUBLE_HIT);
    expect(taken(hit.events)).toEqual([]);
    expect(cancelledAttacks(hit.events)).toHaveLength(1);
    expect(cancelSkips(hit.events)).toEqual([twice.villain]);
    expect(counters(hit.state, twice.supports[0]!, "cancelled")).toBe(1);
  });

  it("interpretation: damage dealt before the cancel stays dealt, and that enemy was attacked", () => {
    const t = table(PLAIN_V, [VILLAIN_PARRY_S, MINION_HUNTER_S, VILLAIN_HUNTER_S], [SPIKY]);
    const after = play(t, ONE_TWO);
    // 2 to the minion; the attack on the villain is cancelled; the last sentence's 1 to the minion is not dealt.
    expect(amountsTo(after.events, t.minions[0]!)).toEqual([2]);
    expect(amountsTo(after.events, t.villain)).toEqual([]);
    expect(cancelSkips(after.events)).toEqual([t.minions[0]!]);
    // The minion was attacked by the first attack: it retaliates, and "after you attack a minion" answers.
    expect(attackedIn(after.events)).toEqual([t.minions[0]!]);
    expect(amountsTo(after.events, t.hero)).toEqual([2]);
    expect(counters(after.state, t.supports[1]!, "attacks")).toBe(1);
    expect(counters(after.state, t.supports[2]!, "attacks")).toBe(0);
    expect(after.state.stack).toEqual([]);
  });

  it("an unlabeled ability makes no attack, so there is nothing to cancel: its damage is dealt", () => {
    const t = table(PLAIN_V, [PARRY_S]);
    const after = play(t, LOOSE_JAB);
    expect(amountsTo(after.events, t.villain)).toEqual([3]);
    expect(counters(after.state, t.supports[0]!, "cancelled")).toBe(0);
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
