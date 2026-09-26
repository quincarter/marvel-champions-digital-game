/**
 * docs/phase7-wave4.md §3.5: damage on a card that is not a character, and "the unique rule does not apply". Synthetic
 * cards shaped like Tower Defense's Avengers Tower (`mts` 21100a/b): Stronghold side, "The unique rule does not apply to
 * Avengers Tower. Forced Response: After damage is placed here, if there is at least 9[per_hero] damage here, remove all
 * of it. Then flip Avengers Tower over."; Damaged side, "Forced Response: After damage is placed here, if there is at
 * least 9[per_hero] damage here, the players lose the game." Rain Fire (21109): "Deal 3 damage to Avengers Tower."
 *
 * Sources: MC21 p. 11 ("When damage is dealt to Avengers Tower it must be applied to the Avengers Tower environment
 * card"; the Stronghold side "allows each player to play the Avengers Tower support card"); RRG 1.8 "Damage" (p. 14),
 * "Flip" (p. 20), "Unique Icon" (pp. 45–46).
 */

import type { SupportCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEnvironment, stubEvent, stubSupport } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, playFree } from "./testing/wave3.js";
import { matchingCardInPlay } from "./unique.js";

const TITLE = "Avengers Tower";
const self: TargetRef = { kind: "self" };
const damageHere: ValueSpec = { kind: "damage", of: self };
const nineDamage: Predicate = {
  kind: "compare",
  left: damageHere,
  op: "atLeast",
  right: { kind: "perPlayer", base: 0, perPlayer: 9 },
};
const afterDamageHere = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, {
    trigger: { kind: "response", forced: true, on: { on: "dealDamage", selfIs: "target" } },
    effects: [{ kind: "if", condition: nineDamage, then: effects }],
  } satisfies AbilityDefinition);

const STRONGHOLD_UNIQUE = stubAbility("tower-a.constant", {
  trigger: { kind: "constant", rules: [{ kind: "uniqueRuleExempt", title: TITLE }] },
  effects: [],
});
const STRONGHOLD_FLIP = afterDamageHere("tower-a.forced-response", [
  { kind: "heal", target: self, amount: damageHere },
  { kind: "flipCard", target: self },
]);
const DAMAGED_LOSS = afterDamageHere("tower-b.forced-response", [{ kind: "endGame", result: "loss" }]);
const TOWER = {
  ...stubEnvironment({
    id: "tower",
    name: TITLE,
    abilities: [STRONGHOLD_UNIQUE.ref, STRONGHOLD_FLIP.ref],
    flipSide: { name: TITLE, abilities: [DAMAGED_LOSS.ref] },
  }),
  unique: true,
};
const TOWER_SUPPORT: SupportCard = { ...stubSupport({ id: "tower-support", cost: 0 }), name: TITLE, unique: true };

const damageTower = (amount: number) => {
  const effects: EffectSpec[] = [
    { kind: "dealDamage", target: { kind: "named", name: TITLE }, amount: { kind: "const", value: amount } },
  ];
  const ability = stubAbility(`rain-fire-${amount}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id: `rain-fire-${amount}`, cost: 0, abilities: [ability.ref] }), ability };
};
const RAIN_FIRE = damageTower(3);

const deps: EngineDeps = depsOf(STRONGHOLD_UNIQUE, STRONGHOLD_FLIP, DAMAGED_LOSS, RAIN_FIRE.ability);

function start(): { state: GameState; tower: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [TOWER, TOWER_SUPPORT, RAIN_FIRE.card],
    deps,
    encounter: [TOWER.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [TOWER_SUPPORT.id, ...copiesOf(RAIN_FIRE.card.id, 8)],
  });
  const placed = encounterCardInVillainArea(base, TOWER.id);
  return { state: placed.state, tower: placed.id };
}
const rainFire = (state: GameState, times: number): GameState => {
  let current = state;
  for (let i = 0; i < times; i++) current = playFree(current, deps, RAIN_FIRE.card.id).state;
  return current;
};

describe("§3.5 damage on a card that is not a character", () => {
  it("damage dealt to the environment stays on it, and it is not defeated", () => {
    const { state, tower } = start();
    const after = rainFire(state, 2);
    expect(mustInstance(after, tower).damage).toBe(6);
    expect(after.villainArea).toContain(tower);
  });

  it("at 9 per player it is cleared and flipped; at 9 more on the Damaged side, the players lose", () => {
    const { state, tower } = start();
    const stronghold = rainFire(state, 3);
    expect(mustInstance(stronghold, tower).damage).toBe(0);
    expect(mustInstance(stronghold, tower).flipped).toBe(true);
    expect(stronghold.outcome).toBeNull();
    const last = playFree(rainFire(stronghold, 2), deps, RAIN_FIRE.card.id);
    expect(last.state.outcome?.result).toBe("loss");
    const replayed = replay(last.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(last.session.state);
  });

  it("the Stronghold side lets a unique card of the same title enter play; the Damaged side does not", () => {
    const { state } = start();
    expect(matchingCardInPlay(state, TOWER_SUPPORT, new Set(), null, deps)).toBeNull();
    const damaged = rainFire(state, 3);
    expect(matchingCardInPlay(damaged, TOWER_SUPPORT, new Set(), null, deps)).not.toBeNull();
  });
});
