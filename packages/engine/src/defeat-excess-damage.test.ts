/**
 * docs/phase7-wave5.md §4.1 Q68: a character's defeat records the excess damage that defeated it (`characterDefeated`
 * `excessDamage`), read by `ValueSpec defeatExcessDamage` in its When Defeated abilities and "after … is defeated"
 * responses. For Shifting Apparition (`sm` 27091): "When Defeated: If this minion was defeated with excess damage, …".
 *
 * Sources: RRG 1.8 "Excess Damage" (p. 19): "any amount of damage that is dealt to a character beyond that character's
 * remaining hit points" — any damage, not only an attack's, measured against *remaining* hit points, so exactly lethal
 * damage has none. RRG 1.8 "Overkill" (p. 31): "If a card ability counts excess damage dealt, that ability counts the
 * same value of excess damage that is calculated when resolving the overkill keyword" (`excessDamageOf`: damage taken,
 * so prevented damage is never excess). RRG 1.8 "Defeat" (p. 15): a defeat by an effect that is not damage has no
 * damage behind it, so no excess. Synthetic cards.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { Command } from "./commands.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { driveSession } from "./testing/drive.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const mark = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: tracker,
  counterType,
  amount,
});
const excess: ValueSpec = { kind: "defeatExcessDamage" };
const one: ValueSpec = { kind: "const", value: 1 };

/** "When Defeated: …" on the minion itself: marks that it resolved and the excess it read. */
const WHEN_DEFEATED = stubAbility("minion.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    mark("whenDefeated", one),
    {
      kind: "if",
      condition: { kind: "compare", left: excess, op: "atLeast", right: one },
      then: [mark("withExcess", one), mark("excess", excess)],
    },
  ],
});
/** "Forced Response: After a minion is defeated, …" on the tracker: the same read from the defeat's response window. */
const DEFEAT_RESPONSE = stubAbility("tracker.defeat-response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["minion"] } } },
  effects: [mark("responseExcess", excess)],
});

const damageEvent = (id: string, amount: number, name: string) => {
  const action = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [
      {
        kind: "dealDamage",
        target: { kind: "each", query: { categories: ["minion"], name } },
        amount: { kind: "const", value: amount },
      },
    ],
  });
  return { action, card: stubEvent({ id, cost: 0, abilities: [action.ref] }) };
};
/** "Deal 3 damage to the grunt" (an event, not an attack). */
const ZAP = damageEvent("zap", 3, "grunt");
/** "Deal 1 damage to the grunt": exactly lethal. */
const TAP = damageEvent("tap", 1, "grunt");
/** "Deal 2 damage to each minion": one effect, both dealt at once (a damage group). */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["minion"] } },
      amount: { kind: "const", value: 2 },
    },
  ],
});
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });
/** "Defeat the grunt." */
const WIPE_ACTION = stubAbility("wipe.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "defeat", target: { kind: "each", query: { categories: ["minion"], name: "grunt" } } }],
});
const WIPE = stubEvent({ id: "wipe", cost: 0, abilities: [WIPE_ACTION.ref] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 1, abilities: [WHEN_DEFEATED.ref] });
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 2, abilities: [WHEN_DEFEATED.ref] });
const TRACKER = stubSupport({ id: "tracker", cost: 0, abilities: [DEFEAT_RESPONSE.ref] });

const deps: EngineDeps = depsOf(WHEN_DEFEATED, DEFEAT_RESPONSE, ZAP.action, TAP.action, SWEEP_ACTION, WIPE_ACTION);

interface Table {
  readonly state: GameState;
  readonly tracker: InstanceId;
  readonly grunt: InstanceId;
  readonly brute: InstanceId;
  readonly identity: InstanceId;
}

/** P1 in hero form (the stub hero has ATK 2), the tracker in play, a grunt (1 HP) and a brute (2 HP) engaged. */
function table(): Table {
  const start = gameAtFirstTurn({
    cards: [GRUNT, BRUTE, TRACKER, ZAP.card, TAP.card, SWEEP, WIPE],
    deps,
    deck: [TRACKER.id, ZAP.card.id, TAP.card.id, SWEEP.id, WIPE.id],
    encounter: [...copiesOf(TREACHERY.id, 28), GRUNT.id, BRUTE.id],
  });
  const heroes: GameState = {
    ...start,
    players: start.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const withTracker = playerCardIntoPlay(heroes, TRACKER.id);
  const grunt = minionEngagedWith(withTracker.state, GRUNT.id);
  const brute = minionEngagedWith(grunt.state, BRUTE.id);
  return {
    state: brute.state,
    tracker: withTracker.id,
    grunt: grunt.id,
    brute: brute.id,
    identity: mustPlayer(brute.state, P1).identity.instanceId,
  };
}

const drive = (state: GameState, commands: readonly Command[]) => driveSession(startSession(state), deps, commands);

function play(state: GameState, card: string) {
  const given = giveCard(state, P1, card);
  return drive(given.state, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
}

const attack = (t: Table, state: GameState, target: InstanceId) =>
  drive(state, [{ type: "basicAttack", playerId: P1, attackerInstanceId: t.identity, targetInstanceId: target }]);

const marks = (state: GameState, t: Table) => mustInstance(state, t.tracker).counters;
const discarded = (state: GameState, id: InstanceId) =>
  Object.values(state.encounterDecks).some((piles) => piles.discard.includes(id));
/** The `excessDamage` each minion's `characterDefeated` trigger event carried, as the log recorded it. */
const loggedExcess = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "characterDefeated"
      ? [[e.event.instanceId, e.event.excessDamage ?? 0] as const]
      : [],
  );
const expectReplays = (session: GameSession) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("§4.1 Q68 a defeat records its excess damage", () => {
  it("an attack past remaining hit points: ATK 2 into a 1-HP minion defeats it with 1 excess", () => {
    const t = table();
    const { session, events } = attack(t, t.state, t.grunt);
    expect(discarded(session.state, t.grunt)).toBe(true);
    expect(marks(session.state, t)).toMatchObject({ whenDefeated: 1, withExcess: 1, excess: 1, responseExcess: 1 });
    expect(loggedExcess(events)).toEqual([[t.grunt, 1]]);
    expectReplays(session);
  });

  it("exactly lethal is not excess: ATK 2 into a 2-HP minion", () => {
    const t = table();
    const { session, events } = attack(t, t.state, t.brute);
    expect(discarded(session.state, t.brute)).toBe(true);
    expect(marks(session.state, t)["whenDefeated"]).toBe(1);
    expect(marks(session.state, t)["withExcess"]).toBeUndefined();
    expect(marks(session.state, t)["responseExcess"]).toBeUndefined();
    expect(loggedExcess(events)).toEqual([[t.brute, 0]]);
  });

  it("measured against remaining hit points: ATK 2 into a 2-HP minion already carrying 1 damage is 1 excess", () => {
    const t = table();
    const damaged: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.brute]: { ...mustInstance(t.state, t.brute), damage: 1 } },
    };
    const { session } = attack(t, damaged, t.brute);
    expect(marks(session.state, t)).toMatchObject({ whenDefeated: 1, withExcess: 1, excess: 1 });
  });

  it("damage from an event (not an attack) counts: 3 damage into a 1-HP minion is 2 excess", () => {
    const t = table();
    const { session } = play(t.state, ZAP.card.id);
    expect(discarded(session.state, t.grunt)).toBe(true);
    expect(marks(session.state, t)).toMatchObject({ whenDefeated: 1, withExcess: 1, excess: 2, responseExcess: 2 });
    expectReplays(session);
  });

  it("exactly lethal event damage is not excess", () => {
    const t = table();
    const { session } = play(t.state, TAP.card.id);
    expect(discarded(session.state, t.grunt)).toBe(true);
    expect(marks(session.state, t)["whenDefeated"]).toBe(1);
    expect(marks(session.state, t)["withExcess"]).toBeUndefined();
  });

  it("one effect damaging several minions at once records each one's own excess", () => {
    const t = table();
    const { session, events } = play(t.state, SWEEP.id);
    expect(discarded(session.state, t.grunt)).toBe(true);
    expect(discarded(session.state, t.brute)).toBe(true);
    // Grunt: 2 into 1 HP, 1 excess. Brute: 2 into 2 HP, exactly lethal.
    expect(marks(session.state, t)).toMatchObject({ whenDefeated: 2, withExcess: 1, excess: 1, responseExcess: 1 });
    expect(new Map(loggedExcess(events))).toEqual(
      new Map([
        [t.grunt, 1],
        [t.brute, 0],
      ]),
    );
    expectReplays(session);
  });

  it("a defeat by an effect that is not damage has no excess", () => {
    const t = table();
    const { session } = play(t.state, WIPE.id);
    expect(discarded(session.state, t.grunt)).toBe(true);
    expect(marks(session.state, t)["whenDefeated"]).toBe(1);
    expect(marks(session.state, t)["withExcess"]).toBeUndefined();
  });

  it("prevented damage is not excess: a tough status stops the attack and nothing is defeated", () => {
    const t = table();
    const tough: GameState = {
      ...t.state,
      instances: {
        ...t.state.instances,
        [t.grunt]: {
          ...mustInstance(t.state, t.grunt),
          statuses: { ...mustInstance(t.state, t.grunt).statuses, tough: 1 },
        },
      },
    };
    const { session, events } = attack(t, tough, t.grunt);
    expect(mustInstance(session.state, t.grunt).damage).toBe(0);
    expect(loggedExcess(events)).toEqual([]);
    expect(marks(session.state, t)["whenDefeated"]).toBeUndefined();
  });
});
