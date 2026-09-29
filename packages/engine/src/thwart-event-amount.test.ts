/**
 * A thwart's event amount (`ValueSpec eventAmount`) for a basic thwart as for a "(thwart)" ability: in its interrupt
 * window, the threat it is about to remove (a basic thwart: the thwarter's current THW); in its response window, the
 * threat it actually removed, 0 when nothing was left to remove. "After [character] thwarts and removes threat from a
 * scheme, … remove an equal amount" (Lady Spider, `spiderham` 30012) reads the second.
 *
 * Sources: RRG 1.8 "Thwart" (p. 44): a basic thwart "removes threat equal to the character's THW value from the
 * scheme"; "Basic Power" (p. 10).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubResource } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const counters = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "self" },
  counterType,
  amount: { kind: "eventAmount" },
});
/** "Forced Interrupt: When this ally thwarts, place counters equal to the threat it would remove on it." */
const SEEN = stubAbility("watcher.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "thwart", selfIs: "source" } },
  effects: [counters("seen")],
} satisfies AbilityDefinition);
/** "Forced Response: After this ally thwarts, place counters equal to the threat it removed on it." */
const REMOVED = stubAbility("watcher.response", {
  trigger: { kind: "response", forced: true, on: { on: "thwart", selfIs: "source" } },
  effects: [counters("removed")],
} satisfies AbilityDefinition);
/** "Action: Exhaust this ally → it thwarts, removing 3 threat from the main scheme." (Its THW is 2.) */
const THWART_3 = stubAbility("watcher.action", {
  trigger: { kind: "action" },
  cost: { exhaustSelf: true },
  effects: [
    { kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 3 }, thwarter: { kind: "self" } },
  ] as EffectSpec[],
} satisfies AbilityDefinition);
const WATCHER = stubAlly({
  id: "watcher",
  cost: 0,
  atk: 1,
  thw: 2,
  hp: 5,
  abilities: [SEEN.ref, REMOVED.ref, THWART_3.ref],
});

/** "Forced Interrupt: When this ally thwarts, remove 9 threat from that scheme." Leaves the thwart nothing to remove. */
const DRAIN = stubAbility("drainer.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "thwart", selfIs: "source" } },
  effects: [
    { kind: "removeThreat", target: { kind: "eventTarget" }, amount: { kind: "const", value: 9 } },
  ] as EffectSpec[],
} satisfies AbilityDefinition);
const DRAINER = stubAlly({
  id: "drainer",
  cost: 0,
  atk: 1,
  thw: 2,
  hp: 5,
  abilities: [DRAIN.ref, REMOVED.ref],
});

const FILLER = stubResource({ id: "filler", icons: 0, produces: { mental: 1 } });
const deps: EngineDeps = depsOf(SEEN, REMOVED, THWART_3, DRAIN);

function start(ally: typeof WATCHER, threat: number): { readonly state: GameState; readonly ally: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [WATCHER, DRAINER, FILLER],
    deps,
    deck: [WATCHER.id, DRAINER.id, ...copiesOf(FILLER.id, 5)],
  });
  const main = state.mainScheme.instanceId;
  const set: GameState = {
    ...state,
    instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat } },
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const placed = playerCardIntoPlay(set, ally.id);
  return { state: placed.state, ally: placed.id };
}

const basicThwart = (state: GameState, ally: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: ally,
  schemeInstanceId: state.mainScheme.instanceId,
});
const useAction = (ally: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: ally,
  abilityId: THWART_3.ref.id,
  payment: [],
});
const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const countersOn = (state: GameState, id: InstanceId, type: string): number =>
  mustInstance(state, id).counters[type] ?? 0;
const resolvedThwartAmounts = (events: readonly GameEvent[]): readonly (number | null | undefined)[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart" ? [e.event.amount] : [],
  );
const expectReplay = (session: GameSession): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("a thwart's event amount", () => {
  it("a basic thwart's event carries its THW before it resolves and the threat it removed after; replay deep-equal", () => {
    const { state, ally } = start(WATCHER, 5);
    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, ally)]);
    expect(mainThreat(session.state)).toBe(3);
    expect(countersOn(session.state, ally, "seen")).toBe(2);
    expect(countersOn(session.state, ally, "removed")).toBe(2);
    expect(resolvedThwartAmounts(events)).toEqual([2]);
    expectReplay(session);
  });

  it("a basic thwart against less threat than its THW carries the threat actually removed, not its THW", () => {
    const { state, ally } = start(WATCHER, 1);
    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, ally)]);
    expect(mainThreat(session.state)).toBe(0);
    expect(countersOn(session.state, ally, "seen")).toBe(2);
    expect(countersOn(session.state, ally, "removed")).toBe(1);
    expect(resolvedThwartAmounts(events)).toEqual([1]);
  });

  it("a basic thwart left nothing to remove carries 0 after it resolves", () => {
    const { state, ally } = start(DRAINER, 4);
    const { session, events } = driveSession(startSession(state), deps, [basicThwart(state, ally)]);
    // The interrupt removed all 4; the thwart itself removed none.
    expect(mainThreat(session.state)).toBe(0);
    expect(countersOn(session.state, ally, "removed")).toBe(0);
    expect(resolvedThwartAmounts(events)).toEqual([0]);
  });

  it("a thwart through an ability carries its printed amount before it resolves and the threat it removed after", () => {
    const { state, ally } = start(WATCHER, 2);
    const { session, events } = driveSession(startSession(state), deps, [useAction(ally)]);
    expect(mainThreat(session.state)).toBe(0);
    expect(countersOn(session.state, ally, "seen")).toBe(3);
    expect(countersOn(session.state, ally, "removed")).toBe(2);
    expect(resolvedThwartAmounts(events)).toEqual([2]);
    expectReplay(session);
  });
});
