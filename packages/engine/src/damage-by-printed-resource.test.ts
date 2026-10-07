/**
 * docs/phase7-wave6.md §3.68: damage by its source's printed resource, and doubled damage. Synthetic villains shaped
 * like Goblin (39043: "can only take damage from cards with a printed [physical] resource"), Troll (39044: "takes 1
 * additional damage from each card with a printed [mental] resource"), Dragon (39042: "Double the amount of damage this
 * minion takes from cards with a printed [energy] resource") and Vampire (39051: "Attacks with piercing deal double
 * damage to Vampire").
 *
 * Sources: RRG 1.8 "Modifiers" (p. 29): additive and subtractive modifiers before doubling. §4 Q39 (default): the
 * source card is the event/support/upgrade whose ability dealt the damage, the identity for a basic attack. §4 Q40
 * (default): an addition comes before the doubling, (3 + 1) × 2 = 8.
 */

import { flat, type ResourceIconCounts } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const constant = (id: string, rules: readonly RuleSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] } satisfies AbilityDefinition);

const GOBLIN = constant("goblin.constant", [
  { kind: "cannotTakeDamage", target: { self: true }, exceptFromSource: { printedResource: "physical" } },
]);
const TROLL = constant("troll.constant", [
  { kind: "increaseDamageTaken", target: { self: true }, amount: 1, fromSource: { printedResource: "mental" } },
]);
const DRAGON = constant("dragon.constant", [
  { kind: "doubleDamageTaken", target: { self: true }, fromSource: { printedResource: "energy" } },
]);
/** Q40's shape: an addition from every [energy] card next to Dragon's doubling. */
const PLUS_ENERGY = constant("plus-energy.constant", [
  { kind: "increaseDamageTaken", target: { self: true }, amount: 1, fromSource: { printedResource: "energy" } },
]);
const VAMPIRE = constant("vampire.constant", [
  { kind: "doubleDamageTaken", target: { self: true }, attackKeyword: "piercing" },
]);
const CAP_5 = constant("cap.constant", [{ kind: "maxDamageTakenPerAttack", target: { self: true }, amount: 5 }]);
const RULES = [GOBLIN, TROLL, DRAGON, PLUS_ENERGY, VAMPIRE, CAP_5];

type StubRef = (typeof GOBLIN)["ref"];
const villain = (id: string, abilities: readonly StubRef[]) =>
  stubVillain({ id, stages: [{ hp: flat(40), atk: 1, sch: 1, abilities }] });
const GOBLIN_V = villain("goblin", [GOBLIN.ref]);
const TROLL_V = villain("troll", [TROLL.ref]);
const DRAGON_V = villain("dragon", [DRAGON.ref]);
const DRAGON_PLUS_V = villain("dragon-plus", [DRAGON.ref, PLUS_ENERGY.ref]);
const DRAGON_CAPPED_V = villain("dragon-capped", [DRAGON.ref, CAP_5.ref]);
const VAMPIRE_V = villain("vampire", [VAMPIRE.ref]);
const VILLAINS = [GOBLIN_V, TROLL_V, DRAGON_V, DRAGON_PLUS_V, DRAGON_CAPPED_V, VAMPIRE_V];

const actionEvent = (id: string, icons: ResourceIconCounts, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, resourceIcons: icons, abilities: [ability.ref] }), ability };
};
const zap = (amount: number): EffectSpec[] => [{ kind: "dealDamage", target: theVillain, amount: n(amount) }];
const PHYSICAL_ZAP = actionEvent("physical-zap", { physical: 1 }, zap(2));
const MENTAL_ZAP = actionEvent("mental-zap", { mental: 1 }, zap(2));
const ENERGY_ZAP = actionEvent("energy-zap", { energy: 1 }, zap(3));
const PHYSICAL_ATTACK = actionEvent("physical-attack", { physical: 1 }, [
  { kind: "attack", target: theVillain, amount: n(2) },
]);
const ENERGY_ATTACK = actionEvent("energy-attack", { energy: 1 }, [
  { kind: "attack", target: theVillain, amount: n(3) },
]);
const PIERCING_ATTACK = actionEvent("piercing-attack", { mental: 1 }, [
  { kind: "attack", target: theVillain, amount: n(2), keywords: ["piercing"] },
]);
const PLAIN_ATTACK = actionEvent("plain-attack", { mental: 1 }, [{ kind: "attack", target: theVillain, amount: n(2) }]);
/** "Deal 2 damage to the villain and confuse it": a second effect on the target keeps it valid (RRG 1.8 "Target", p. 43). */
const CONFUSING_ATTACK = actionEvent("confusing-attack", { mental: 1 }, [
  { kind: "attack", target: theVillain, amount: n(2) },
  { kind: "giveStatus", target: theVillain, status: "confused" },
]);
const EVENTS = [
  PHYSICAL_ZAP,
  MENTAL_ZAP,
  ENERGY_ZAP,
  PHYSICAL_ATTACK,
  ENERGY_ATTACK,
  PIERCING_ATTACK,
  PLAIN_ATTACK,
  CONFUSING_ATTACK,
];

const deps: EngineDeps = depsOf(...RULES, ...EVENTS.map((e) => e.ability));

function start(v: (typeof VILLAINS)[number]): GameState {
  const state = gameAtFirstTurn({
    cards: [...VILLAINS, ...EVENTS.map((e) => e.card)],
    deps,
    villain: v,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;
const play = (v: (typeof VILLAINS)[number], event: (typeof EVENTS)[number]) => playFree(start(v), deps, event.card.id);
const doubled = (events: readonly GameEvent[]) => events.filter((e) => e.type === "damageDoubled");

describe("§3.68 'can only take damage from cards with a printed [physical] resource' (Goblin)", () => {
  it("takes damage from a [physical] card's ability and from an attack made through one; replay deep-equal", () => {
    expect(villainDamage(play(GOBLIN_V, PHYSICAL_ZAP).state)).toBe(2);
    const { state, session } = play(GOBLIN_V, PHYSICAL_ATTACK);
    expect(villainDamage(state)).toBe(2);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("is no valid target for a card without one: the event cannot be played", () => {
    expect(() => play(GOBLIN_V, MENTAL_ZAP)).toThrow(/no valid target/);
  });

  it("nor for an attack made through a card without one; one that also confuses it deals nothing, logged as 'cannot take damage'", () => {
    expect(() => play(GOBLIN_V, PLAIN_ATTACK)).toThrow(/no valid target/);
    const { state, events } = play(GOBLIN_V, CONFUSING_ATTACK);
    expect(villainDamage(state)).toBe(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damagePrevented", amount: 2, reason: "cannotTakeDamage" }),
    );
  });

  // The identity has no printed resource (§4 Q39), so its basic attack could deal no damage, and a target that cannot
  // take damage is not a valid target of a basic attack (RRG 1.8 "Target", p. 43; ruling Mar 19, 2026 (2)).
  it("a hero's basic attack cannot target it: the identity has no printed resource (§4 Q39)", () => {
    const state = start(GOBLIN_V);
    const hero = state.players[0]!.identity.instanceId;
    const result = applyCommand(
      state,
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: state.villains[0]!.instanceId },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
  });
});

describe("§3.68 'takes 1 additional damage from each card with a printed [mental] resource' (Troll)", () => {
  it("adds 1 to damage from a [mental] card only", () => {
    expect(villainDamage(play(TROLL_V, MENTAL_ZAP).state)).toBe(3);
    expect(villainDamage(play(TROLL_V, PHYSICAL_ZAP).state)).toBe(2);
    expect(villainDamage(play(TROLL_V, PLAIN_ATTACK).state)).toBe(3);
  });
});

describe("§3.68 'Double the amount of damage this minion takes from cards with a printed [energy] resource' (Dragon)", () => {
  it("doubles damage from an [energy] card and logs damageDoubled", () => {
    const { state, events } = play(DRAGON_V, ENERGY_ZAP);
    expect(villainDamage(state)).toBe(6);
    expect(doubled(events)).toEqual([
      {
        type: "damageDoubled",
        targetInstanceId: state.villains[0]!.instanceId,
        from: 3,
        to: 6,
        doubledBy: [state.villains[0]!.instanceId],
      },
    ]);
  });

  it("leaves damage from any other card alone", () => {
    const { state, events } = play(DRAGON_V, PHYSICAL_ZAP);
    expect(villainDamage(state)).toBe(2);
    expect(doubled(events)).toEqual([]);
  });

  it("doubles after additions: (3 + 1) × 2 = 8 (RRG 1.8 p. 29, §4 Q40)", () => {
    expect(villainDamage(play(DRAGON_PLUS_V, ENERGY_ZAP).state)).toBe(8);
  });

  it("doubles before a per-attack cap: 3 × 2 = 6, held to 5", () => {
    expect(villainDamage(play(DRAGON_CAPPED_V, ENERGY_ATTACK).state)).toBe(5);
  });
});

describe("§3.68 'Attacks with piercing deal double damage to Vampire'", () => {
  it("doubles a piercing attack's damage", () => {
    expect(villainDamage(play(VAMPIRE_V, PIERCING_ATTACK).state)).toBe(4);
  });

  it("does not double an attack without piercing, or damage that is not an attack", () => {
    expect(villainDamage(play(VAMPIRE_V, PLAIN_ATTACK).state)).toBe(2);
    expect(villainDamage(play(VAMPIRE_V, MENTAL_ZAP).state)).toBe(2);
  });
});
