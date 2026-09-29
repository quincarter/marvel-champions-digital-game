/**
 * docs/phase7-wave5.md §4.1 Q62: `EventPattern.consequential` — "When a S.H.I.E.L.D. ally would take any amount of
 * consequential damage" (Field Agent, `sm` 27044), "When Cannonball would take any amount of consequential damage"
 * (`angel` 42020), "When another Aerial ally would take any amount of consequential damage" (Wingman, `falcon` 53024).
 * Synthetic cards: a forced interrupt counting each consequential damage an ally would take, and its `false` twin
 * counting every other damage to that ally.
 *
 * RRG 1.8 "Consequential Damage" (p. 13): "After an ally attacks or thwarts, it takes one consequential damage for each
 * consequential damage icon in that field." Damage from anything else — including damage the ally deals itself — is not
 * consequential.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

/** "Action: deal 1 damage to this ally" — non-attack damage whose source is its own target, like consequential damage. */
const SELF_HARM = stubAbility("grunt.self-harm", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "self" }, amount: { kind: "const", value: 1 } }],
});
const GRUNT = stubAlly({ id: "grunt", cost: 0, atk: 1, thw: 1, hp: 9, abilities: [SELF_HARM.ref] });
const OTHER = stubAlly({ id: "other", cost: 0, atk: 1, thw: 1, hp: 9 });

const watching = (consequential: boolean, counter: string) =>
  stubAbility(`watcher.${counter}`, {
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "dealDamage", targetIs: { name: "grunt" }, consequential },
    },
    effects: [
      { kind: "addCounters", target: { kind: "self" }, counterType: counter, amount: { kind: "const", value: 1 } },
    ],
  });
const SEES_CONSEQUENTIAL = watching(true, "consequential");
const SEES_OTHER = watching(false, "other");
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [SEES_CONSEQUENTIAL.ref, SEES_OTHER.ref] });
const STURDY = stubMinion({ id: "sturdy", atk: 0, sch: 0, hp: 20 });
const PLOT = stubSideScheme({ id: "plot", startingThreat: 5 });

const deps: EngineDeps = depsOf(SELF_HARM, SEES_CONSEQUENTIAL, SEES_OTHER);
const CARDS = [GRUNT, OTHER, WATCHER, STURDY, PLOT];
const ENCOUNTER: readonly CardId[] = [STURDY.id, PLOT.id];

interface Table {
  readonly state: GameState;
  readonly grunt: InstanceId;
  readonly other: InstanceId;
  readonly watcher: InstanceId;
  readonly sturdy: InstanceId;
  readonly plot: InstanceId;
}

function table(): Table {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: [GRUNT.id, OTHER.id, WATCHER.id], encounter: ENCOUNTER });
  const watcher = playerCardIntoPlay(base, WATCHER.id);
  const grunt = playerCardIntoPlay(watcher.state, GRUNT.id);
  const other = playerCardIntoPlay(grunt.state, OTHER.id);
  const sturdy = minionEngagedWith(other.state, STURDY.id);
  const plot = encounterCardInVillainArea(sturdy.state, PLOT.id, 5);
  return {
    state: plot.state,
    grunt: grunt.id,
    other: other.id,
    watcher: watcher.id,
    sturdy: sturdy.id,
    plot: plot.id,
  };
}

const run = (t: Table, command: Parameters<typeof runCommandsPicking>[3]) =>
  runCommandsPicking(t.state, deps, defaultPick, command);
const counters = (state: GameState, t: Table) => mustInstance(state, t.watcher).counters;

describe("§4.1 Q62 a damage trigger can require consequential damage", () => {
  it("fires on the ally's consequential damage from attacking; replay is deterministic", () => {
    const t = table();
    const { state, session } = run(t, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: t.grunt,
      targetInstanceId: t.sturdy,
    });
    expect(mustInstance(state, t.grunt).damage).toBe(1);
    expect(counters(state, t)).toEqual({ consequential: 1 });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("fires on the ally's consequential damage from thwarting", () => {
    const t = table();
    const { state } = run(t, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: t.grunt,
      schemeInstanceId: t.plot,
    });
    expect(mustInstance(state, t.grunt).damage).toBe(1);
    expect(counters(state, t)).toEqual({ consequential: 1 });
  });

  it("does not fire on ordinary damage to that ally, even damage it deals itself", () => {
    const t = table();
    const { state } = run(t, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: t.grunt,
      abilityId: SELF_HARM.ref.id,
      payment: [],
    });
    expect(mustInstance(state, t.grunt).damage).toBe(1);
    expect(counters(state, t)).toEqual({ other: 1 });
  });

  it("does not fire on another character's consequential damage", () => {
    const t = table();
    const { state } = run(t, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: t.other,
      targetInstanceId: t.sturdy,
    });
    expect(mustInstance(state, t.other).damage).toBe(1);
    expect(counters(state, t)).toEqual({});
  });
});
