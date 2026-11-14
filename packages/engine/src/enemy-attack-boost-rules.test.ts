/**
 * The boost cards of an enemy's boosted attack on another enemy (`enemyAttacksEnemy.boost`; Headpool, FFG ruling
 * January 26, 2026 (4)), and three primitives the Punisher community scenario needs for them, on synthetic cards:
 *
 * - `RuleSpec ignoreBoost` with `only: "abilities"`: "ignore each 'Boost' ability", the icons still counting;
 * - `RuleSpec boostIconsMultiplied`: "each boost icon counts twice", scoped by a `while` on the attack in progress;
 * - an interrupt to an enemy's attack on this card (`{ on: "attack", selfIs: "target" }`, heard on `enemyAttacksEnemy`)
 *   whose `modifyAttack({ extraBoostCards })` gives that attack another boost card, as it does an activation.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: named("recorder"),
  counterType,
  amount: { kind: "const", value: 1 },
});
/** "[star] Boost: …": marks the recorder, so a test sees whether the Boost ability resolved. */
const BOOST_MARKS = stubAbility("booster.boost", { trigger: { kind: "boost" }, effects: [mark("boosted")] });
const BOOSTER = stubTreachery({ id: "booster", boostIcons: 2, starIcon: true, abilities: [BOOST_MARKS.ref] });

/** "While the brute attacks a minion" (`attackInProgress`). */
const BRUTE_ATTACKS_A_MINION: Predicate = {
  kind: "attackInProgress",
  attacker: { name: "brute" },
  target: { categories: ["minion"] },
};
const constantCard = (
  id: string,
  rules: NonNullable<Extract<AbilityDefinition["trigger"], { kind: "constant" }>["rules"]>,
) => {
  const ability = stubAbility(`${id}.constant`, { trigger: { kind: "constant", rules }, effects: [] });
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const IGNORE_ABILITIES = constantCard("ignore-abilities", [
  { kind: "ignoreBoost", only: "abilities", enemy: { name: "brute" }, while: BRUTE_ATTACKS_A_MINION },
]);
const IGNORE_ALL = constantCard("ignore-all", [{ kind: "ignoreBoost", enemy: { name: "brute" } }]);
const DOUBLER = constantCard("doubler", [
  { kind: "boostIconsMultiplied", factor: 2, enemy: { name: "brute" }, while: BRUTE_ATTACKS_A_MINION },
]);

/** "When the brute attacks the puzzle, give the brute an additional boost card for this attack" (Jigsaw's shape). */
const PUZZLE_INTERRUPT = stubAbility("puzzle.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target", sourceIs: { name: "brute" } } },
  effects: [{ kind: "modifyAttack", extraBoostCards: 1 }],
});

const BRUTE = stubMinion({ id: "brute", atk: 3, sch: 1, hp: 30, keywords: [{ name: "villainous" }] });
const TARGET = stubMinion({ id: "target", atk: 0, sch: 1, hp: 30 });
const PUZZLE = stubMinion({ id: "puzzle", atk: 0, sch: 1, hp: 30, abilities: [PUZZLE_INTERRUPT.ref] });
const RECORDER = stubSupport({ id: "recorder", cost: 0 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const boostedAttack = (target: string): EffectSpec => ({
  kind: "enemyAttacksEnemy",
  attacker: named("brute"),
  target: named(target),
  boost: true,
});
const HITS_TARGET = actionEvent("hits-target", [boostedAttack("target")]);
const HITS_PUZZLE = actionEvent("hits-puzzle", [boostedAttack("puzzle")]);
/** The control: the brute's own activation against you (the attack's target is your identity, not a minion). */
const ATTACKS_YOU = actionEvent("attacks-you", [{ kind: "enemyAttack", enemies: named("brute") }]);
const EVENTS = [HITS_TARGET, HITS_PUZZLE, ATTACKS_YOU];
const RULE_CARDS = [IGNORE_ABILITIES, IGNORE_ALL, DOUBLER];

const deps: EngineDeps = depsOf(
  BOOST_MARKS,
  PUZZLE_INTERRUPT,
  ...RULE_CARDS.map((c) => c.ability),
  ...EVENTS.map((e) => e.ability),
);

interface Table {
  readonly state: GameState;
  readonly ids: Readonly<Record<string, InstanceId>>;
  readonly recorder: InstanceId;
}

/** The brute and the named minions engaged with player 1, the recorder and `rules` in play, boosters on the deck. */
function table(minions: readonly string[], rules: readonly (typeof RULE_CARDS)[number][] = []): Table {
  const base = gameAtFirstTurn({
    cards: [RECORDER, BRUTE, TARGET, PUZZLE, BOOSTER, ...RULE_CARDS.map((c) => c.card), ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [BRUTE.id, TARGET.id, PUZZLE.id, ...copiesOf(BOOSTER.id, 12)],
    deck: [RECORDER.id, ...RULE_CARDS.map((c) => c.card.id), ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = playerCardIntoPlay(state, RECORDER.id);
  state = placed.state;
  for (const rule of rules) state = playerCardIntoPlay(state, rule.card.id).state;
  const ids: Record<string, InstanceId> = {};
  for (const minion of ["brute", ...minions]) {
    const engaged = minionEngagedWith(state, minion as never);
    state = engaged.state;
    ids[minion] = engaged.id;
  }
  return { state, ids, recorder: placed.id };
}

const counters = (state: GameState, id: InstanceId, type: string): number =>
  mustInstance(state, id).counters[type] ?? 0;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const identityDamage = (state: GameState): number => mustInstance(state, state.players[0]!.identity.instanceId).damage;

describe("a boosted enemy-against-enemy attack (Headpool's shape), unmodified", () => {
  it("deals one boost card: its 2 icons add to the 3 ATK and its Boost ability resolves", () => {
    const t = table(["target"]);
    const { state, events } = playFree(t.state, deps, HITS_TARGET.card.id);
    expect(ofType(events, "boostCardDealt")).toHaveLength(1);
    expect(mustInstance(state, t.ids.target!).damage).toBe(5);
    expect(counters(state, t.recorder, "boosted")).toBe(1);
  });
});

describe("RuleSpec ignoreBoost only: 'abilities' ('ignore each Boost ability', the icons still count)", () => {
  it("the boost card's icons still add to the attack, and its Boost ability does not resolve", () => {
    const t = table(["target"], [IGNORE_ABILITIES]);
    const { state, events } = playFree(t.state, deps, HITS_TARGET.card.id);
    expect(mustInstance(state, t.ids.target!).damage, "3 ATK + 2 icons").toBe(5);
    expect(counters(state, t.recorder, "boosted")).toBe(0);
    expect(ofType(events, "boostIgnored")).toEqual([
      { type: "boostIgnored", enemyInstanceId: t.ids.brute, instanceId: expect.any(String), abilityOnly: true },
    ]);
    // Nothing was cancelled: the card is ignored, not cancelled (RRG 1.8 "Ignore", p. 23).
    expect(ofType(events, "boostCancelled")).toEqual([]);
    expect(ofType(events, "boostCardFlipped")[0]?.boostIcons).toBe(2);
  });

  it("its `while` scopes it: the brute's activation against you resolves the Boost ability as usual", () => {
    const t = table([], [IGNORE_ABILITIES]);
    const { state, events } = playFree(t.state, deps, ATTACKS_YOU.card.id);
    expect(counters(state, t.recorder, "boosted")).toBe(1);
    expect(ofType(events, "boostIgnored")).toEqual([]);
    expect(identityDamage(state), "3 ATK + 2 icons, undefended").toBe(5);
  });

  it("a rule ignoring the whole card wins: 0 icons and no ability", () => {
    const t = table(["target"], [IGNORE_ABILITIES, IGNORE_ALL]);
    const { state, events } = playFree(t.state, deps, HITS_TARGET.card.id);
    expect(mustInstance(state, t.ids.target!).damage).toBe(3);
    expect(counters(state, t.recorder, "boosted")).toBe(0);
    expect(ofType(events, "boostIgnored").map((e) => e.abilityOnly)).toEqual([undefined]);
  });
});

describe("RuleSpec boostIconsMultiplied ('each boost icon counts twice')", () => {
  it("doubles the boost card's icons on the brute's attack against a minion, and logs the count", () => {
    const t = table(["target"], [DOUBLER]);
    const { state, events } = playFree(t.state, deps, HITS_TARGET.card.id);
    expect(mustInstance(state, t.ids.target!).damage, "3 ATK + 2 icons counted twice").toBe(7);
    expect(ofType(events, "boostIconsMultiplied")).toEqual([
      {
        type: "boostIconsMultiplied",
        enemyInstanceId: t.ids.brute,
        instanceId: expect.any(String),
        factor: 2,
        counted: 2,
        icons: 4,
      },
    ]);
    // The Boost ability is untouched.
    expect(counters(state, t.recorder, "boosted")).toBe(1);
  });

  it("its `while` scopes it: the brute's activation against you counts the icons once", () => {
    const t = table([], [DOUBLER]);
    const { state, events } = playFree(t.state, deps, ATTACKS_YOU.card.id);
    expect(identityDamage(state)).toBe(5);
    expect(ofType(events, "boostIconsMultiplied")).toEqual([]);
  });

  it("with the Boost abilities ignored too, the icons still count twice", () => {
    const t = table(["target"], [DOUBLER, IGNORE_ABILITIES]);
    const { state } = playFree(t.state, deps, HITS_TARGET.card.id);
    expect(mustInstance(state, t.ids.target!).damage).toBe(7);
    expect(counters(state, t.recorder, "boosted")).toBe(0);
  });
});

describe("an interrupt to an enemy's attack on this card gives that attack an additional boost card (Jigsaw's shape)", () => {
  it("the brute's attack on the puzzle is dealt two boost cards, both counted", () => {
    const t = table(["puzzle"]);
    const { state, events } = playFree(t.state, deps, HITS_PUZZLE.card.id);
    expect(ofType(events, "boostCardDealt")).toHaveLength(2);
    expect(mustInstance(state, t.ids.puzzle!).damage, "3 ATK + 2 + 2").toBe(7);
    expect(counters(state, t.recorder, "boosted")).toBe(2);
  });

  it("the brute's attack on another minion keeps its one boost card", () => {
    const t = table(["puzzle", "target"]);
    const { events } = playFree(t.state, deps, HITS_TARGET.card.id);
    expect(ofType(events, "boostCardDealt")).toHaveLength(1);
  });

  it("with every icon counting twice, both cards are doubled", () => {
    const t = table(["puzzle"], [DOUBLER]);
    const { state, events } = playFree(t.state, deps, HITS_PUZZLE.card.id);
    expect(ofType(events, "boostIconsMultiplied")).toHaveLength(2);
    expect(mustInstance(state, t.ids.puzzle!).damage, "3 ATK + 4 + 4").toBe(11);
  });
});
