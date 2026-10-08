/**
 * The log's `defenderDeclared` for a defender a card ability declared (`EffectSpec declareDefender`). Synthetic ally
 * shaped like "Forced Interrupt: When the villain attacks you, declare this ally the defender [without exhausting it]."
 *
 * Sources: RRG 1.8 "Defend, Defense" (p. 15): "When a card ability says to 'declare [an ally] the defender' of an
 * attack, that ally becomes the defender", as a character declared in the attack's own step 2 does ("Attack (Enemy
 * Activation)", p. 9). The log records both, the ability's marked `byEffect`.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const declares = (id: string, exhaust: boolean, times = 1) =>
  stubAbility(id, {
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
    },
    effects: Array.from({ length: times }, () => ({
      kind: "declareDefender" as const,
      character: { kind: "self" as const },
      ...(exhaust ? { exhaust: true } : {}),
    })),
  });
const READY_GUARD = declares("guard.forced-interrupt", false);
const TIRED_GUARD = declares("tired.forced-interrupt", true);
const TWICE_GUARD = declares("twice.forced-interrupt", false, 2);
const ally = (id: string, ability?: StubAbility) =>
  stubAlly({ id, cost: 0, atk: 1, thw: 1, hp: 9, abilities: ability ? [ability.ref] : [] });
const GUARD = ally("guard", READY_GUARD);
const TIRED = ally("tired", TIRED_GUARD);
const TWICE = ally("twice", TWICE_GUARD);
const PLAIN = ally("plain");

const deps: EngineDeps = depsOf(READY_GUARD, TIRED_GUARD, TWICE_GUARD);

function villainPhase(card: ReturnType<typeof ally>, declareAtStep = false) {
  const base = gameAtFirstTurn({ cards: [GUARD, TIRED, TWICE, PLAIN], deps, deck: [card.id] });
  const placed = playerCardIntoPlay(base, card.id);
  // An enemy attacks a hero (RRG 1.8 "Villain Phase", p. 47): hero form (surgery).
  const state: GameState = {
    ...placed.state,
    players: placed.state.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const, heroFormIndex: 0 },
    })),
  };
  const pick = (current: GameState): readonly string[] =>
    current.pendingChoice?.prompt.kind === "declareDefender" && declareAtStep ? [placed.id] : defaultPick(current);
  const { session, events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  return { state: session.state, events, ally: placed.id, villain: state.villains[0]!.instanceId };
}
const declared = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: "defenderDeclared" }> => e.type === "defenderDeclared");
const heroDamage = (state: GameState): number => mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;
const index = (events: readonly GameEvent[], id: InstanceId, type: GameEvent["type"]) =>
  events.findIndex((e) => e.type === type && "instanceId" in e && e.instanceId === id);

describe("a defender declared by a card ability is logged", () => {
  it("'declare this ally the defender without exhausting it': one defenderDeclared, byEffect, by its controller", () => {
    const run = villainPhase(GUARD);
    expect(declared(run.events)).toEqual([
      {
        type: "defenderDeclared",
        attackInstanceId: run.villain,
        defenderInstanceId: run.ally,
        playerId: P1,
        byEffect: true,
      },
    ]);
    // It is the defender: it took the attack, ready, and the hero took nothing.
    expect(mustInstance(run.state, run.ally).damage).toBeGreaterThan(0);
    expect(mustInstance(run.state, run.ally).exhausted).toBe(false);
    expect(heroDamage(run.state)).toBe(0);
    // Nobody is asked to defend an attack that has its defender.
    expect(run.events.some((e) => e.type === "defenseDeclined")).toBe(false);
  });

  it("'exhaust it and declare it the defender': exhausted, then declared", () => {
    const run = villainPhase(TIRED);
    expect(declared(run.events)).toHaveLength(1);
    expect(declared(run.events)[0]).toMatchObject({ defenderInstanceId: run.ally, byEffect: true });
    const exhausted = index(run.events, run.ally, "cardExhausted");
    expect(exhausted).toBeGreaterThan(-1);
    expect(run.events.findIndex((e) => e.type === "defenderDeclared")).toBeGreaterThan(exhausted);
  });

  it("declaring the character that already defends declares nothing new: logged once", () => {
    const run = villainPhase(TWICE);
    expect(declared(run.events)).toHaveLength(1);
  });

  it("the step's own declaration is logged as before, without byEffect, by the attacked player", () => {
    const run = villainPhase(PLAIN, true);
    expect(declared(run.events)).toEqual([
      { type: "defenderDeclared", attackInstanceId: run.villain, defenderInstanceId: run.ally, playerId: P1 },
    ]);
    expect(mustInstance(run.state, run.ally).exhausted).toBe(true);
  });
});
