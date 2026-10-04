/**
 * docs/phase7-wave6.md §3.40: the basic recovery as an event, and §4.1 Q20. A synthetic card shaped like Death Factor
 * (35030: "Alter-Ego Interrupt: When you make a basic recovery, discard this card instead of healing damage").
 *
 * Sources: RRG 1.8 "Recover, Recovery" (p. 36): the alter-ego exhausts and heals damage equal to its REC; with no damage
 * to heal it cannot recover. Q20: "instead of healing damage" replaces the healing only, so the identity still exhausts
 * and has still made a basic recovery ("after you recover" answers).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const counter = (type: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "identityOf", player: { kind: "controller" } },
  counterType: type,
  amount: { kind: "const", value: 1 },
});

/** Death Factor's shape: when you make a basic recovery, discard this card instead of healing damage. */
const FACTOR_ABILITY = stubAbility(
  "factor.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "basicRecovery", playerIs: "controller" } },
    effects: [{ kind: "replaceTriggeringEvent", with: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
  }),
);
const FACTOR = stubSupport({ id: "factor", cost: 0, abilities: [FACTOR_ABILITY.ref] });
/** "After you recover, …" (Phoenix's shape): `basicPowerUsed` narrowed to the recovery. */
const AFTER_ABILITY = stubAbility(
  "after.response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "basicPowerUsed", playerIs: "controller", eventIs: { power: "recover" } },
    },
    effects: [counter("recovered")],
  }),
);
const AFTER = stubSupport({ id: "after", cost: 0, abilities: [AFTER_ABILITY.ref] });

const deps = depsOf(FACTOR_ABILITY, AFTER_ABILITY);
const recover: Command = { type: "basicRecover", playerId: P1 };
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;

/** P1's alter-ego (the stub hero: REC 3) with `damage` damage and the given supports in play. */
function start(damage: number, ...supports: readonly (typeof FACTOR)[]) {
  let state = gameAtFirstTurn({ cards: [FACTOR, AFTER], deps, deck: [FACTOR.id, AFTER.id] });
  const ids: InstanceId[] = [];
  for (const support of supports) {
    const placed = playerCardIntoPlay(state, support.id);
    state = placed.state;
    ids.push(placed.id);
  }
  const identity = identityOf(state);
  expect(mustPlayer(state, P1).identity.form).toBe("alterEgo");
  state = { ...state, instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), damage } } };
  return { state, ids };
}

function run(state: GameState) {
  const driven = driveSession(startSession(state), deps, [recover]);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}

describe("§3.40 the basic recovery as an event (Death Factor, Q20)", () => {
  it("an 'instead of healing' replacement: the identity exhausts, heals nothing, still recovered", () => {
    const { state, ids } = start(5, FACTOR, AFTER);
    const [factor] = ids;
    const identity = identityOf(state);
    const { state: after, events } = run(state);
    // Exhausted, nothing healed, and "after you recover" answered.
    expect(mustInstance(after, identity)).toMatchObject({ damage: 5, exhausted: true });
    expect(mustInstance(after, identity).counters["recovered"]).toBe(1);
    expect(events.some((e) => e.type === "damageHealed")).toBe(false);
    // The replacement ran: the card is discarded.
    expect(mustPlayer(after, P1).playArea).not.toContain(factor);
    expect(mustPlayer(after, P1).discard).toContain(factor);
    // The recovery's healing was replaced (cancelled), the basic power still announced.
    expect(
      events.some((e) => e.type === "triggerEvent" && e.event.kind === "basicRecovery" && e.phase === "cancelled"),
    ).toBe(true);
    expect(
      events.some(
        (e) =>
          e.type === "triggerEvent" &&
          e.event.kind === "basicPowerUsed" &&
          e.event.power === "recover" &&
          e.phase === "resolved",
      ),
    ).toBe(true);
  });

  it("with nothing replacing it, the event frame heals by REC and 'after you recover' answers", () => {
    const { state } = start(5, AFTER);
    const identity = identityOf(state);
    const { state: after, events } = run(state);
    expect(mustInstance(after, identity)).toMatchObject({ damage: 2, exhausted: true });
    expect(mustInstance(after, identity).counters["recovered"]).toBe(1);
    expect(events.filter((e) => e.type === "damageHealed")).toEqual([
      { type: "damageHealed", targetInstanceId: identity, amount: 3 },
    ]);
  });

  it("with no listener, the recovery heals at once, unchanged", () => {
    const { state } = start(5);
    const identity = identityOf(state);
    const { state: after, events } = run(state);
    expect(mustInstance(after, identity)).toMatchObject({ damage: 2, exhausted: true });
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "basicRecovery")).toBe(false);
  });

  it("at full HP the recovery is refused, so the replacement cannot shed the card", () => {
    const { state, ids } = start(0, FACTOR);
    const [factor] = ids;
    const identity = identityOf(state);
    const result = applyCommand(state, recover, deps);
    expect(result.ok ? null : result.error.code).toBe("no_valid_target");
    expect(mustInstance(state, identity).exhausted).toBe(false);
    expect(mustPlayer(state, P1).playArea).toContain(factor);
  });
});
