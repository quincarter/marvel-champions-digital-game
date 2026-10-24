/**
 * An ally's basic attack or thwart whose target leaves play before the power resolves.
 *
 * RRG v1.8 p.13 "Consequential Damage": "If the target of an ally's basic power leaves play before that ally deals
 * damage equal to its ATK or removes threat equal to its THW, the ally does not take consequential damage (but still
 * exhausts). That ally is not considered to have attacked or thwarted for the purpose of other abilities." Its Iron
 * Fist example: an interrupt to the attack that defeats the enemy aborts the basic attack "as soon as the target leaves
 * play", so Iron Fist takes no consequential damage from it.
 *
 * Synthetic allies: a forced interrupt to their own attack (thwart) discards the enemy (scheme) it is made against,
 * and a forced response "after this ally attacks (thwarts)" gives it a stunned status card, so the response firing is
 * visible on the ally.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const self = { kind: "self" } as const;
const def = (definition: AbilityDefinition) => definition;

const DISCARD_ATTACKED = stubAbility(
  "discard-attacked.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "source" } },
    effects: [{ kind: "discardFromPlay", target: { kind: "eventTarget" } }],
  }),
);
const DISCARD_THWARTED = stubAbility(
  "discard-thwarted.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "thwart", selfIs: "source" } },
    effects: [{ kind: "discardFromPlay", target: { kind: "eventTarget" } }],
  }),
);
const AFTER_ATTACKS = stubAbility(
  "after-attacks.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "attack", selfIs: "source" } },
    effects: [{ kind: "giveStatus", target: self, status: "stunned" }],
  }),
);
const AFTER_THWARTS = stubAbility(
  "after-thwarts.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "thwart", selfIs: "source" } },
    effects: [{ kind: "giveStatus", target: self, status: "stunned" }],
  }),
);

/** Discards what it attacks or thwarts, as the power is made. */
const VANISHER = stubAlly({
  id: "vanisher",
  cost: 0,
  atk: 2,
  thw: 2,
  hp: 5,
  consequentialAttack: 1,
  consequentialThwart: 1,
  abilities: [DISCARD_ATTACKED.ref, DISCARD_THWARTED.ref, AFTER_ATTACKS.ref, AFTER_THWARTS.ref],
});
/** The control: the same ally without the discarding interrupts. */
const STEADY = stubAlly({
  id: "steady",
  cost: 0,
  atk: 2,
  thw: 2,
  hp: 5,
  consequentialAttack: 1,
  consequentialThwart: 1,
  abilities: [AFTER_ATTACKS.ref, AFTER_THWARTS.ref],
});
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
const PLOT = stubSideScheme({ id: "plot", startingThreat: 5, boostIcons: 0 });

const deps: EngineDeps = depsOf(DISCARD_ATTACKED, DISCARD_THWARTED, AFTER_ATTACKS, AFTER_THWARTS);

function table(ally: typeof VANISHER) {
  const base = gameAtFirstTurn({
    cards: [VANISHER, STEADY, THUG, PLOT],
    deps,
    deck: [VANISHER.id, STEADY.id],
    encounter: [THUG.id, PLOT.id, ...copiesOf(TREACHERY.id, 20)],
  });
  const placed = playerCardIntoPlay(base, ally.id);
  const engaged = minionEngagedWith(placed.state, THUG.id);
  const scheme = encounterCardInVillainArea(engaged.state, PLOT.id, 5);
  return { state: scheme.state, ally: placed.id, thug: engaged.id, plot: scheme.id };
}

function run(state: GameState, command: Command) {
  const { session, events } = driveSession(startSession(state), deps, [command]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));

describe("RRG v1.8 p.13: the target of an ally's basic power leaves play before it resolves", () => {
  it("attack: an interrupt discards the attacked minion; no consequential damage, no 'after this ally attacks'", () => {
    const { state, ally, thug } = table(VANISHER);
    const after = run(state, { type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: thug });
    expect(activeEncounterDeck(after.state).discard).toContain(thug);
    expect(mustPlayer(after.state, P1).playArea).not.toContain(thug);
    expect(damageTo(after.events, thug)).toEqual([]);
    // The ally still exhausts, but takes no consequential damage and is not considered to have attacked.
    expect(mustInstance(after.state, ally).exhausted).toBe(true);
    expect(mustInstance(after.state, ally).damage).toBe(0);
    expect(damageTo(after.events, ally)).toEqual([]);
    expect(mustInstance(after.state, ally).statuses.stunned).toBe(0);
    expect(after.events.some((e) => e.type === "playerAttackEnded" && e.reason === "targetLeftPlay")).toBe(true);
  });

  it("attack control: the minion stays in play; the ally deals its damage and takes its consequential damage", () => {
    const { state, ally, thug } = table(STEADY);
    const after = run(state, { type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: thug });
    expect(mustInstance(after.state, thug).damage).toBe(2);
    expect(mustInstance(after.state, ally).damage).toBe(1);
    expect(mustInstance(after.state, ally).statuses.stunned).toBe(1);
  });

  it("thwart: an interrupt discards the thwarted side scheme; no consequential damage, no 'after this ally thwarts'", () => {
    const { state, ally, plot } = table(VANISHER);
    const after = run(state, { type: "basicThwart", playerId: P1, thwarterInstanceId: ally, schemeInstanceId: plot });
    expect(after.state.villainArea).not.toContain(plot);
    expect(mustInstance(after.state, ally).exhausted).toBe(true);
    expect(mustInstance(after.state, ally).damage).toBe(0);
    expect(damageTo(after.events, ally)).toEqual([]);
    expect(mustInstance(after.state, ally).statuses.stunned).toBe(0);
    expect(after.events.some((e) => e.type === "playerThwartEnded" && e.reason === "targetLeftPlay")).toBe(true);
  });

  it("thwart control: the side scheme stays in play; the ally removes threat and takes its consequential damage", () => {
    const { state, ally, plot } = table(STEADY);
    const after = run(state, { type: "basicThwart", playerId: P1, thwarterInstanceId: ally, schemeInstanceId: plot });
    expect(mustInstance(after.state, plot).threat).toBe(3);
    expect(mustInstance(after.state, ally).damage).toBe(1);
    expect(mustInstance(after.state, ally).statuses.stunned).toBe(1);
  });
});
