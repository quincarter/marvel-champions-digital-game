/**
 * `ValueSpec defeatExcessThreat` (#890 item 8): the threat a scheme's defeating removal attempted beyond what the
 * scheme had, read on its `schemeDefeated` event. "After a side scheme is overdefeated (more threat was removed from it
 * than it had)" (The Rose's Hero Resistance and Rose's Greenhouse, the `the-rose-bf` community pack) is this at least 1,
 * whatever made the removal: a basic thwart or an event's plain "remove N threat".
 *
 * A synthetic support counts the excess on its own counters: "Forced Response: After a side scheme is defeated, place
 * 1 'over' counter here for each threat of excess" (so 0 for an exact defeat).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const COUNTER = stubAbility("counter.response", {
  trigger: { kind: "response", forced: true, on: { on: "schemeDefeated", targetIs: { categories: ["sideScheme"] } } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "self" },
      counterType: "over",
      amount: { kind: "defeatExcessThreat" },
    },
    { kind: "addCounters", target: { kind: "self" }, counterType: "seen", amount: { kind: "const", value: 1 } },
  ],
} satisfies AbilityDefinition);
const COUNTER_CARD = stubSupport({ id: "counter", cost: 0, abilities: [COUNTER.ref] });
const THWARTER = stubAlly({ id: "thwarter", cost: 0, atk: 1, thw: 3, hp: 5 });
/** "Remove 4 threat from a scheme": the event's own removal, not a thwart. */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseTarget", slot: "scheme", query: { categories: ["sideScheme"] }, chooser: { kind: "controller" } },
    { kind: "removeThreat", target: { kind: "slot", slot: "scheme" }, amount: { kind: "const", value: 4 } },
  ],
} satisfies AbilityDefinition);
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });
const HIDEOUT = stubSideScheme({ id: "hideout", startingThreat: 2 });

const deps: EngineDeps = depsOf(COUNTER, SWEEP_ACTION);

function start(threat: number): { state: GameState; counter: InstanceId; thwarter: InstanceId; scheme: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [COUNTER_CARD, THWARTER, SWEEP, HIDEOUT],
    deps,
    deck: [COUNTER_CARD.id, THWARTER.id, SWEEP.id, SWEEP.id],
    encounter: [HIDEOUT.id],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const placed = encounterCardInVillainArea(heroes, HIDEOUT.id, threat);
  const counter = playerCardIntoPlay(placed.state, COUNTER_CARD.id, P1);
  const thwarter = playerCardIntoPlay(counter.state, THWARTER.id, P1);
  return { state: thwarter.state, counter: counter.id, thwarter: thwarter.id, scheme: placed.id };
}

function run(state: GameState, command: Command): GameState {
  const driven = driveSession(startSession(state), deps, [command], defaultPick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return driven.session.state;
}
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;

describe("defeatExcessThreat: how much a side scheme was overdefeated by (#890 item 8)", () => {
  it("THW 3 on a 1-threat scheme: defeated with 2 to spare", () => {
    const s = start(1);
    const after = run(s.state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: s.thwarter,
      schemeInstanceId: s.scheme,
    });
    expect(after.villainArea).not.toContain(s.scheme);
    expect(counters(after, s.counter).seen).toBe(1);
    expect(counters(after, s.counter).over).toBe(2);
  });

  it("THW 3 on a 3-threat scheme: exactly defeated, no excess", () => {
    const s = start(3);
    const after = run(s.state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: s.thwarter,
      schemeInstanceId: s.scheme,
    });
    expect(after.villainArea).not.toContain(s.scheme);
    expect(counters(after, s.counter).seen).toBe(1);
    expect(counters(after, s.counter).over ?? 0).toBe(0);
  });

  it("an event's plain removal (not a thwart) of 4 on a 1-threat scheme: 3 of excess", () => {
    const s = start(1);
    const given = giveCard(s.state, P1, SWEEP.id);
    const after = run(given.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(after.villainArea).not.toContain(s.scheme);
    expect(counters(after, s.counter).over).toBe(3);
  });
});
