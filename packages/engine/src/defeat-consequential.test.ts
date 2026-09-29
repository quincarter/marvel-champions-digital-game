/**
 * A character's defeat records whether the defeating damage was an ally's consequential damage (`characterDefeated`
 * `consequential`), and `ValueSpec defeatExcessDamage`'s `consequential` option reads excess damage only from that
 * damage. For SP//dr (`spiderham` 30021): "When Defeated: Add SP//dr to your hand if she was defeated by taking excess
 * consequential damage."
 *
 * Sources: RRG 1.8 "Consequential Damage" (p. 13): "After an ally attacks [thwarts], it takes consequential damage equal
 * to the number of consequential damage icons beneath its ATK [THW] field", the same damage for an attack and a
 * thwart. RRG 1.8 "Excess Damage" (p. 19): damage "beyond that character's remaining hit points", so exactly lethal
 * damage has none. RRG 1.8 "When Defeated Abilities" (p. 48): a forced interrupt to the defeat, resolved before the card
 * leaves play, so it reads the defeat event. Synthetic cards.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const mark = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: tracker,
  counterType,
  amount,
});
const one: ValueSpec = { kind: "const", value: 1 };
const consequentialExcess: ValueSpec = { kind: "defeatExcessDamage", consequential: true };
const otherExcess: ValueSpec = { kind: "defeatExcessDamage", consequential: false };
const atLeastOne = (value: ValueSpec) => ({
  kind: "compare" as const,
  left: value,
  op: "atLeast" as const,
  right: one,
});

/** "When Defeated: …" on each ally: marks what it read. */
const WHEN_DEFEATED = stubAbility("ally.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    mark("whenDefeated", one),
    {
      kind: "if",
      condition: atLeastOne(consequentialExcess),
      then: [mark("consequentialExcess", consequentialExcess)],
    },
    { kind: "if", condition: atLeastOne(otherExcess), then: [mark("otherExcess", otherExcess)] },
  ],
});
/** 1 HP, 2 consequential damage after attacking or thwarting: 1 excess. */
const FLIMSY = stubAlly({
  id: "flimsy",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 1,
  consequentialAttack: 2,
  consequentialThwart: 2,
  abilities: [WHEN_DEFEATED.ref],
});
/** 2 HP, 2 consequential damage after attacking: exactly lethal. */
const STURDY = stubAlly({
  id: "sturdy",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 2,
  consequentialAttack: 2,
  abilities: [WHEN_DEFEATED.ref],
});
/** "Deal 3 damage to flimsy" (an event: excess, but not consequential). */
const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["ally"], name: "flimsy" } },
      amount: { kind: "const", value: 3 },
    },
  ],
});
const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [ZAP_ACTION.ref] });
const TANK = stubMinion({ id: "tank", atk: 1, sch: 1, hp: 10 });
const TRACKER = stubSupport({ id: "tracker", cost: 0 });

const deps: EngineDeps = depsOf(WHEN_DEFEATED, ZAP_ACTION);

interface Table {
  readonly state: GameState;
  readonly tracker: InstanceId;
  readonly flimsy: InstanceId;
  readonly sturdy: InstanceId;
  readonly tank: InstanceId;
}

function table(): Table {
  const start = gameAtFirstTurn({
    cards: [FLIMSY, STURDY, ZAP, TANK, TRACKER],
    deps,
    deck: [TRACKER.id, FLIMSY.id, STURDY.id, ZAP.id],
    encounter: [...copiesOf(TREACHERY.id, 28), TANK.id],
  });
  const withTracker = playerCardIntoPlay(start, TRACKER.id);
  const flimsy = playerCardIntoPlay(withTracker.state, FLIMSY.id);
  const sturdy = playerCardIntoPlay(flimsy.state, STURDY.id);
  const tank = minionEngagedWith(sturdy.state, TANK.id);
  return { state: tank.state, tracker: withTracker.id, flimsy: flimsy.id, sturdy: sturdy.id, tank: tank.id };
}

const drive = (state: GameState, commands: readonly Command[]) => driveSession(startSession(state), deps, commands);
const attackWith = (t: Table, ally: InstanceId) =>
  drive(t.state, [{ type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: t.tank }]);
const marks = (state: GameState, t: Table) => mustInstance(state, t.tracker).counters;
const discarded = (state: GameState, id: InstanceId) => mustPlayer(state, P1).discard.includes(id);
/** Each `characterDefeated` trigger event's `consequential`/`excessDamage`, as the log recorded it. */
const loggedDefeats = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "characterDefeated"
      ? [[e.event.instanceId, e.event.consequential === true, e.event.excessDamage ?? 0] as const]
      : [],
  );

describe("a defeat records whether consequential damage defeated it", () => {
  it("excess consequential damage after an attack: 2 into 1 HP is flagged and reads 1", () => {
    const t = table();
    const { session, events } = attackWith(t, t.flimsy);
    expect(discarded(session.state, t.flimsy)).toBe(true);
    expect(mustInstance(session.state, t.tank).damage).toBe(1);
    expect(loggedDefeats(events)).toEqual([[t.flimsy, true, 1]]);
    expect(marks(session.state, t)).toMatchObject({ whenDefeated: 1, consequentialExcess: 1 });
    expect(marks(session.state, t)["otherExcess"]).toBeUndefined();
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("consequential damage after a thwart counts the same", () => {
    const t = table();
    const scheme = t.state.mainScheme!.instanceId;
    const threatened: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [scheme]: { ...mustInstance(t.state, scheme), threat: 3 } },
    };
    const { session, events } = drive(threatened, [
      { type: "basicThwart", playerId: P1, thwarterInstanceId: t.flimsy, schemeInstanceId: scheme },
    ]);
    expect(discarded(session.state, t.flimsy)).toBe(true);
    expect(loggedDefeats(events)).toEqual([[t.flimsy, true, 1]]);
    expect(marks(session.state, t)).toMatchObject({ whenDefeated: 1, consequentialExcess: 1 });
  });

  it("exactly lethal consequential damage is flagged but has no excess", () => {
    const t = table();
    const { session, events } = attackWith(t, t.sturdy);
    expect(discarded(session.state, t.sturdy)).toBe(true);
    expect(loggedDefeats(events)).toEqual([[t.sturdy, true, 0]]);
    expect(marks(session.state, t)["whenDefeated"]).toBe(1);
    expect(marks(session.state, t)["consequentialExcess"]).toBeUndefined();
  });

  it("excess from other damage is not consequential: 3 from an event into 1 HP", () => {
    const t = table();
    const given = giveCard(t.state, P1, ZAP.id);
    const { session, events } = drive(given.state, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    expect(discarded(session.state, t.flimsy)).toBe(true);
    expect(loggedDefeats(events)).toEqual([[t.flimsy, false, 2]]);
    expect(marks(session.state, t)).toMatchObject({ whenDefeated: 1, otherExcess: 2 });
    expect(marks(session.state, t)["consequentialExcess"]).toBeUndefined();
  });
});
