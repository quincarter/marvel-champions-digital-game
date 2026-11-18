/**
 * RRG 1.8 "Player Elimination" (p. 34): "If a player is eliminated in the middle of an attack, that attack ends." An
 * attack already under way when its identity's player is eliminated is marked (`Frame<"event">.attackerEliminated`,
 * `eliminatePlayer`) and ends at whatever step it is (`resolve/eliminated-attack.ts`): before its damage step, no
 * damage; after it, an "(attack)" ability's attack waiting for the rest of its ability names nothing as attacked and
 * opens no "after … attacks" window. Either way not "attacked", so no retaliate.
 * Only an attack that begins afterwards, in a new ability the elimination did not interrupt, resolves (#816; the
 * Wolverine's Claws case is in `packages/cards/src/wave6/wolv/wolverine/identity.test.ts`). Synthetic cards only.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSideScheme, stubVillain } from "./testing/fixtures.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";
import { TREACHERY } from "./testing/scenario.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });

/** "Deal 3 damage to the villain." An attack event (unlabeled: the attack instruction is the attack). */
const STRIKE_ACTION = stubAbility("mid-strike.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: n(3) } satisfies EffectSpec],
});
const STRIKE = stubEvent({ id: "mid-strike", cost: 0, abilities: [STRIKE_ACTION.ref] });

/** "Forced Interrupt: When a hero attacks, deal 11 damage to that hero." One more than its 10 hit points. */
const SNARE_INTERRUPT = stubAbility("mid-snare.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack" } },
  effects: [{ kind: "dealDamage", target: { kind: "eventSource" }, amount: n(11) }],
});
const SNARE = stubSideScheme({ id: "mid-snare", startingThreat: 0, abilities: [SNARE_INTERRUPT.ref] });

/** Retaliate 2: it would answer an attack that was made. */
const THORNS = stubVillain({
  id: "mid-thorns",
  stages: [{ hp: flat(60), atk: 1, sch: 1, keywords: [{ name: "retaliate", value: 2 }] }],
});

/**
 * "Hero Action (attack): Deal 3 damage to the villain. Then deal `self` damage to your hero." The attack's damage is
 * dealt first; the second instruction is not the attack's (it is not dealt to an enemy) and, at 11, eliminates the
 * controller while the attack waits beneath its ability (`attack-ability.ts`).
 */
function recklessStrike(id: string, self: number) {
  const definition: AbilityDefinition = {
    trigger: { kind: "action" },
    label: ["attack"],
    effects: [
      { kind: "attack", target: { kind: "villain" }, amount: n(3) },
      { kind: "dealDamage", target: { kind: "identityOf", player: { kind: "controller" } }, amount: n(self) },
    ],
  };
  const ability = stubAbility(`${id}.action`, definition);
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
}
const RECKLESS = recklessStrike("mid-reckless", 11);
const GRAZED = recklessStrike("mid-grazed", 1);

/** "Forced Response: After a hero attacks, place 1 threat here." It answers an attack that resolved. */
const WITNESS_RESPONSE = stubAbility("mid-witness.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "attack" } },
  effects: [{ kind: "placeThreat", target: { kind: "self" }, amount: n(1) }],
});
const WITNESS = stubSideScheme({ id: "mid-witness", startingThreat: 0, abilities: [WITNESS_RESPONSE.ref] });

const deps: EngineDeps = depsOf(STRIKE_ACTION, SNARE_INTERRUPT, RECKLESS.ability, GRAZED.ability, WITNESS_RESPONSE);

/** Both heroes in hero form, with `scheme` (Snare by default) in the villain area. */
function tableWith(scheme: typeof SNARE): { readonly state: GameState; readonly scheme: InstanceId } {
  const base = gameAtFirstTurn({
    deps,
    villain: THORNS,
    players: 2,
    cards: [SNARE, STRIKE, RECKLESS.card, GRAZED.card, WITNESS],
    deck: [STRIKE.id, RECKLESS.card.id, GRAZED.card.id],
    encounter: [scheme.id, ...Array.from({ length: 30 }, () => TREACHERY.id)],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = encounterCardInVillainArea(heroes, scheme.id);
  return { state: placed.state, scheme: placed.id };
}
const table = (): GameState => tableWith(SNARE).state;

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("an attack under way when its player is eliminated ends (RRG 1.8 'Player Elimination', p. 34)", () => {
  it("the interrupt to the attack eliminates the hero: the attack ends, no damage, nothing attacked, no retaliate", () => {
    const start = table();
    const hero = mustPlayer(start, P1).identity.instanceId;
    const villain = start.villains[0]!.instanceId;
    const out = playFree(start, deps, STRIKE.id, P1);

    expect(mustPlayer(out.state, P1).eliminated).toBe(true);
    expect(out.state.outcome).toBeNull();
    expect(of(out.events, "playerAttackEnded")).toEqual([
      { type: "playerAttackEnded", attackerInstanceId: hero, targetInstanceId: villain, reason: "attackerLeftPlay" },
    ]);
    expect(mustInstance(out.state, villain).damage).toBe(0);
    // Not attacked, so Retaliate 2 never answers: the only damage dealt is the interrupt's.
    expect(
      of(out.events, "triggerEvent").some((e) => e.event.kind === "characterAttacked" && e.phase === "resolved"),
    ).toBe(false);
    expect(of(out.events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([[hero, 11]]);
  });

  // PR #826 review: an "(attack)" ability's attack waits beneath its ability once its damage is dealt. A later
  // instruction of that ability eliminating its controller is still the middle of the attack, so it ends there.
  it("a later instruction of the attack ability eliminates its controller: the damage stands, the attack ends", () => {
    const { state: start, scheme: witness } = tableWith(WITNESS);
    const hero = mustPlayer(start, P1).identity.instanceId;
    const villain = start.villains[0]!.instanceId;
    const out = playFree(start, deps, RECKLESS.card.id, P1);

    expect(mustPlayer(out.state, P1).eliminated).toBe(true);
    expect(out.state.outcome).toBeNull();
    // The attack's 3 damage was dealt before the elimination, then the 11 that eliminated the hero.
    expect(of(out.events, "damageDealt").map((e) => [e.targetInstanceId, e.amount])).toEqual([
      [villain, 3],
      [hero, 11],
    ]);
    expect(mustInstance(out.state, villain).damage).toBe(3);
    expect(of(out.events, "playerAttackEnded")).toEqual([
      { type: "playerAttackEnded", attackerInstanceId: hero, targetInstanceId: villain, reason: "attackerLeftPlay" },
    ]);
    // Not attacked (no Retaliate 2) and no "after a hero attacks": the attack never finished resolving.
    const resolved = of(out.events, "triggerEvent").filter((e) => e.phase === "resolved");
    expect(resolved.some((e) => e.event.kind === "characterAttacked")).toBe(false);
    expect(resolved.some((e) => e.event.kind === "attack")).toBe(false);
    expect(of(out.events, "abilityResolved").some((e) => e.abilityId === WITNESS_RESPONSE.ref.id)).toBe(false);
    expect(mustInstance(out.state, witness).threat).toBe(0);
  });

  it("control: the same attack ability without the elimination finishes, and the forced response answers it", () => {
    const { state: start, scheme: witness } = tableWith(WITNESS);
    const hero = mustPlayer(start, P1).identity.instanceId;
    const villain = start.villains[0]!.instanceId;
    const out = playFree(start, deps, GRAZED.card.id, P1);

    expect(mustPlayer(out.state, P1).eliminated).toBe(false);
    expect(of(out.events, "playerAttackEnded")).toEqual([]);
    // Retaliate 2 answers the attack (1 + 2 damage on the hero) and the forced response places its threat.
    expect(mustInstance(out.state, villain).damage).toBe(3);
    expect(mustInstance(out.state, hero).damage).toBe(3);
    expect(mustInstance(out.state, witness).threat).toBe(1);
  });
});
