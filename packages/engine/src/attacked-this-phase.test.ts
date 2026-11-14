/**
 * The per-phase attack record (`GameState.attacksThisPhase`) and `Predicate attackedThisPhase` over it: "an enemy who
 * has been attacked by a hero this phase" (Iron Fist, `iron_fist` 64014), "an enemy who has been attacked by another
 * Martial Artist character this phase" (Colleen Wing 64021). Synthetic cards.
 *
 * - The attacker is recorded as it was when it attacked (its categories and traits; RRG 1.8 "Referential Ability",
 *   p. 36), so a hero who then changed to alter-ego form still attacked as a hero.
 * - "This phase": emptied at each phase boundary, never between two players' turns (RRG 1.8 "Player Phase", p. 34).
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { evaluate, type EffectContext } from "./select.js";
import type { Predicate, TargetCategory } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubAlly, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const MARTIAL_ARTIST = trait("MARTIAL ARTIST");
const STUDENT = stubAlly({ id: "student", traits: [MARTIAL_ARTIST], cost: 0, atk: 1, thw: 1, hp: 5 });
const RIVAL = stubAlly({ id: "rival", traits: [MARTIAL_ARTIST], cost: 0, atk: 1, thw: 1, hp: 5 });
const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps: EngineDeps = depsOf();

function start(): { state: GameState; student: InstanceId; rival: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [STUDENT, RIVAL, BLANK],
    deps,
    villain: BOSS,
    deck: [STUDENT.id, RIVAL.id],
    encounter: copiesOf(BLANK.id, 30),
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const student = playerCardIntoPlay(heroes, STUDENT.id, P1);
  const rival = playerCardIntoPlay(student.state, RIVAL.id, P1);
  return { state: rival.state, student: student.id, rival: rival.id };
}

const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const heroOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const attack = (state: GameState, attacker: InstanceId): GameState =>
  runCommands(state, deps, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: attacker,
    targetInstanceId: villainOf(state),
  }).state;
const as = (self: InstanceId | null): EffectContext => ({
  selfInstanceId: self,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});
const attackedBy = (
  state: GameState,
  opts: { byCategory?: TargetCategory; byTrait?: typeof MARTIAL_ARTIST; except?: boolean; self?: InstanceId } = {},
): boolean => {
  const predicate: Predicate = {
    kind: "attackedThisPhase",
    target: { kind: "villain" },
    ...(opts.byCategory ? { byCategory: opts.byCategory } : {}),
    ...(opts.byTrait ? { byTrait: opts.byTrait } : {}),
    ...(opts.except ? { exceptBy: { kind: "self" } } : {}),
  };
  return evaluate(state, predicate, as(opts.self ?? null));
};

describe("'attacked by <X> this phase' (attacksThisPhase, Predicate attackedThisPhase)", () => {
  it("nothing has been attacked at the start of a phase", () => {
    const { state } = start();
    expect(state.attacksThisPhase).toBeUndefined();
    expect(attackedBy(state)).toBe(false);
  });

  it("a hero's basic attack is recorded with the hero's categories; an ally's is not a hero's", () => {
    const { state, student } = start();
    const byHero = attack(state, heroOf(state));
    expect(byHero.attacksThisPhase).toEqual([
      expect.objectContaining({ attackerInstanceId: heroOf(state), targetInstanceId: villainOf(state) }),
    ]);
    expect(attackedBy(byHero, { byCategory: "hero" })).toBe(true);
    expect(attackedBy(byHero, { byCategory: "ally" })).toBe(false);
    const byAlly = attack(state, student);
    expect(attackedBy(byAlly, { byCategory: "hero" })).toBe(false);
    expect(attackedBy(byAlly, { byCategory: "ally" })).toBe(true);
  });

  it("a hero who attacked and then changed to alter-ego form still attacked as a hero", () => {
    const { state } = start();
    const attacked = attack(state, heroOf(state));
    const flipped: GameState = {
      ...attacked,
      players: attacked.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
    };
    expect(attackedBy(flipped, { byCategory: "hero" })).toBe(true);
  });

  it("'another Martial Artist': its own attack does not count, another Martial Artist's does", () => {
    const { state, student, rival } = start();
    const own = attack(state, student);
    expect(attackedBy(own, { byTrait: MARTIAL_ARTIST, except: true, self: student })).toBe(false);
    const other = attack(own, rival);
    expect(attackedBy(other, { byTrait: MARTIAL_ARTIST, except: true, self: student })).toBe(true);
    // The hero (no Martial Artist trait) is no Martial Artist.
    const byHero = attack(state, heroOf(state));
    expect(attackedBy(byHero, { byTrait: MARTIAL_ARTIST, except: true, self: student })).toBe(false);
  });

  it("is emptied when the phase ends, and replays to the same state", () => {
    const { state } = start();
    const attacked = attack(state, heroOf(state));
    const { session } = driveSession(startSession(attacked), deps, [{ type: "endTurn", playerId: P1 }]);
    // The villain phase (its own attacks included) has ended too: a new player phase starts with nothing recorded.
    expect(session.state.step.phase).toBe("player");
    expect(session.state.attacksThisPhase).toBeUndefined();
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("serializes as plain data", () => {
    const { state } = start();
    const attacked = attack(state, heroOf(state));
    expect(JSON.parse(JSON.stringify(attacked.attacksThisPhase))).toEqual(attacked.attacksThisPhase);
  });
});
