/**
 * RRG 1.8 "Player Elimination" (p. 34): "If a player is eliminated in the middle of an attack, that attack ends." An
 * attack already under way when its identity's player is eliminated is marked (`Frame<"event">.attackerEliminated`,
 * `eliminatePlayer`) and ends at its damage step (`applyPlayerAttack`): no damage, not "attacked", so no retaliate.
 * Only an attack that begins afterwards, in a new ability the elimination did not interrupt, resolves (#816; the
 * Wolverine's Claws case is in `packages/cards/src/wave6/wolv/wolverine/identity.test.ts`). Synthetic cards only.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
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

const deps: EngineDeps = depsOf(STRIKE_ACTION, SNARE_INTERRUPT);

function table(): GameState {
  const base = gameAtFirstTurn({
    deps,
    villain: THORNS,
    players: 2,
    cards: [SNARE, STRIKE],
    deck: [STRIKE.id],
    encounter: [SNARE.id, ...Array.from({ length: 30 }, () => TREACHERY.id)],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  return encounterCardInVillainArea(heroes, SNARE.id).state;
}

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
});
