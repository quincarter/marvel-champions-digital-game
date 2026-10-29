/**
 * Every constant modifier to the damage a character takes applies before its "would take" interrupts (RRG 1.8
 * "Damage", p. 14, step 3), so such an interrupt answers, and "place it here instead" moves, the modified amount:
 * increases, reductions and doubling first, then the caps, the order `damageTakenBreakdown` keeps (a cap last, "cannot"
 * being absolute, RRG 1.8 p. 13).
 *
 * Sources: RRG 1.8 "Abilities" (p. 5) timing priority and FAQ p. 57 (constants before status cards before triggered
 * abilities); FFG rulings June 6, 2024 (post RRG 1.5), Ruling 205 ("Constant abilities that reduce damage will be
 * applied before interrupt abilities that reduce damage": Titanium Exoskeleton reduces the damage to 2, then Magnetic
 * Bubble places 2) and Ruling 206 (Boarding Party taken into account before any interrupts). A "would be dealt"
 * interrupt (step 1) still sees the damage as dealt (`damage-stage-order.test.ts`); the cards' own versions are in
 * `@mc/cards`' `wave6/mut_gen/magneto.test.ts`.
 *
 * Synthetic cards: the constants and interrupts sit on supports and reach the villain.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const VILLAIN = { categories: ["villain"] } as const;

const constant = (id: string, rule: RuleSpec) =>
  stubAbility(`${id}.constant`, {
    trigger: { kind: "constant", rules: [rule] },
    effects: [],
  } satisfies AbilityDefinition);
const interrupt = (id: string, effects: readonly EffectSpec[], wouldBeDealt = false) =>
  stubAbility(`${id}.interrupt`, {
    trigger: {
      kind: "interrupt",
      forced: true,
      ...(wouldBeDealt ? { wouldBeDealt: true } : {}),
      on: { on: "dealDamage", targetIs: VILLAIN },
    },
    effects,
  });

/** "[The villain] cannot take more than 2 damage from a single attack" (Titanium Exoskeleton's shape). */
const CAP2 = constant("cap2", { kind: "maxDamageTakenPerAttack", target: VILLAIN, amount: 2 });
/** The same with a cap of 4. */
const CAP4 = constant("cap4", { kind: "maxDamageTakenPerAttack", target: VILLAIN, amount: 4 });
/** "[The villain] takes 1 less damage from each attack." */
const LESS = constant("less", { kind: "reduceDamageTaken", target: VILLAIN, amount: 1, fromAttack: true });
/** "Increase the damage [the villain] takes from each attack by 1." */
const MORE = constant("more", { kind: "increaseDamageTaken", target: VILLAIN, amount: 1, fromAttack: true });
/** "Double the amount of damage [the villain] takes." */
const DOUBLE = constant("double", { kind: "doubleDamageTaken", target: VILLAIN });
/** Step 1: "When damage would be dealt to [the villain], prevent 3 of it." */
const SHAVE = interrupt("shave", [{ kind: "preventDamage", amount: n(3) }], true);
/** Step 3, Magnetic Bubble's shape: "When [the villain] would take any amount of damage, place it here instead." */
const BUBBLE = interrupt("bubble", [
  {
    kind: "replaceTriggeringEvent",
    with: [{ kind: "addCounters", target: self, counterType: "absorbed", amount: { kind: "eventAmount" } }],
  },
]);
/** Step 3: "When [the villain] would take any amount of damage, prevent 1 of that damage." */
const TRIM = interrupt("trim", [{ kind: "preventDamage", amount: n(1) }]);
/** Step 3: "When [the villain] would take any amount of damage, increase that damage by 3." */
const PUMP = interrupt("pump", [{ kind: "increaseDamage", amount: n(3) }]);

const ABILITIES = { CAP2, CAP4, LESS, MORE, DOUBLE, SHAVE, BUBBLE, TRIM, PUMP };
type Name = keyof typeof ABILITIES;
const SUPPORTS = Object.fromEntries(
  Object.entries(ABILITIES).map(([name, ability]) => [
    name,
    stubSupport({ id: name.toLowerCase(), cost: 0, abilities: [ability.ref] }),
  ]),
) as Record<Name, ReturnType<typeof stubSupport>>;

const attackFor = (amount: number) => {
  const ability = stubAbility(`hit${amount}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "attack", target: theVillain, amount: n(amount) }],
  });
  return { card: stubEvent({ id: `hit${amount}`, cost: 0, abilities: [ability.ref] }), ability };
};
const HITS = [attackFor(5), attackFor(6)] as const;

const deps: EngineDeps = depsOf(...Object.values(ABILITIES), ...HITS.map((hit) => hit.ability));
const CARDS = [...Object.values(SUPPORTS), ...HITS.map((hit) => hit.card)];

/** p1 in hero form with the named supports in play; the ids in the same order. */
function start(names: readonly Name[]): { state: GameState; ids: Record<string, InstanceId> } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [...CARDS.map((c) => c.id), ...HITS.flatMap((hit) => copiesOf(hit.card.id, 2))],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const ids: Record<string, InstanceId> = {};
  for (const name of names) {
    const placed = playerCardIntoPlay(state, SUPPORTS[name].id);
    state = placed.state;
    ids[name] = placed.id;
  }
  return { state, ids };
}
const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;
const absorbed = (state: GameState, id: InstanceId | undefined) => mustInstance(state, id!).counters["absorbed"] ?? 0;

describe("constant modifiers to the damage taken come before 'would take' interrupts (FFG rulings June 6, 2024, 205-206)", () => {
  it("a cap of 2 and a 'takes 1 less' reduction, attacked for 6: the Bubble shape receives 2", () => {
    const { state, ids } = start(["CAP2", "LESS", "BUBBLE"]);
    const { state: after } = playFree(state, deps, HITS[1].card.id);
    expect(absorbed(after, ids["BUBBLE"])).toBe(2);
    expect(villainDamage(after)).toBe(0);
  });

  it("a cap of 2 and a '+1' increase, dealt 5: the Bubble shape receives 2", () => {
    const { state, ids } = start(["CAP2", "MORE", "BUBBLE"]);
    const { state: after } = playFree(state, deps, HITS[0].card.id);
    expect(absorbed(after, ids["BUBBLE"])).toBe(2);
    expect(villainDamage(after)).toBe(0);
  });

  it("a reduction alone, dealt 5: the Bubble shape receives 4, not the 5 dealt", () => {
    const { state, ids } = start(["LESS", "BUBBLE"]);
    const { state: after } = playFree(state, deps, HITS[0].card.id);
    expect(absorbed(after, ids["BUBBLE"])).toBe(4);
  });

  it("a step 1 'would be dealt' prevention runs on the damage dealt; the Bubble shape receives min(cap, what is left)", () => {
    // 5 dealt, 3 prevented at step 1: 2 left, under a cap of 4, so 2.
    const under = start(["SHAVE", "CAP4", "BUBBLE"]);
    expect(absorbed(playFree(under.state, deps, HITS[0].card.id).state, under.ids["BUBBLE"])).toBe(2);
    // 6 dealt, 3 prevented at step 1: 3 left, over a cap of 2, so 2.
    const over = start(["SHAVE", "CAP2", "BUBBLE"]);
    expect(absorbed(playFree(over.state, deps, HITS[1].card.id).state, over.ids["BUBBLE"])).toBe(2);
  });

  it("a known limit: with a doubling rule nothing applies early, so the interrupt sees the amount before the constants", () => {
    // Deliberate (`damageConstantsBeforeWouldTake`): with doubling, RRG 1.8 "Modifiers" (p. 29) has an interrupt's
    // increase added before the doubling (docs/phase7-wave6.md §4 Q40), so the whole calculation waits for the damage
    // step. The Bubble shape receives the 5 dealt, not 5 x 2 capped at 2.
    const bubbled = start(["DOUBLE", "CAP2", "BUBBLE"]);
    expect(absorbed(playFree(bubbled.state, deps, HITS[0].card.id).state, bubbled.ids["BUBBLE"])).toBe(5);
    // The cap still has the last word at take time: (5 - 1) x 2 = 8, capped at 2.
    const trimmed = start(["DOUBLE", "CAP2", "TRIM"]);
    expect(villainDamage(playFree(trimmed.state, deps, HITS[0].card.id).state)).toBe(2);
  });

  it("an interrupt that increases the capped damage: the cap still has the last word when it is taken", () => {
    const { state } = start(["CAP2", "PUMP"]);
    const { state: after, events } = playFree(state, deps, HITS[0].card.id);
    expect(villainDamage(after)).toBe(2);
    // The resolved event reads as it does with no interrupt: 5 dealt, 5 + 3 left before the constants, 2 taken.
    const resolved = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "dealDamage" ? [e.event] : [],
    );
    expect(resolved).toMatchObject([{ amount: 8, dealt: 8, taken: 2 }]);
    expect(resolved[0]).not.toHaveProperty("constantsApplied");
  });
});
