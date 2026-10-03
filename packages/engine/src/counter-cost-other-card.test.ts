/**
 * docs/phase7-wave6.md §3.85: a counter cost paid from another card, named by a `TargetRef`
 * (`AbilityCost.spendCounters.target`). Synthetic cards shaped like Psionic Bond (`phoenix` 34001a: "Hero Resource: Remove
 * 1 power counter from Phoenix Force → generate a [wild] resource") and Phoenix Force, Restrained (34002a: "Forced
 * Response: After the last power counter is removed from here, flip this card", §4.1 Q24), carried by supports and an
 * upgrade so the stub hero stays the default one.
 *
 * Sources: RRG 1.8 "Cost" (p. 13): a cost is paid in full or not at all; "Initiating Abilities" (p. 24), steps 5-6, and
 * "Cost Arrow Icon" (p. 14): what paying the cost triggers resolves before the effects it pays for.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const FORCE_REF: TargetRef = { kind: "named", name: "force" };
const villainDamage: AbilityDefinition["effects"][number] = {
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: { kind: "const", value: 1 },
};

/** "Action: Remove 1 power counter from Force → deal 1 damage to the villain." */
const BOND_ACTION = stubAbility(
  "bond.action",
  def({
    trigger: { kind: "action" },
    cost: { spendCounters: { counterType: "power", amount: 1, target: FORCE_REF } },
    effects: [villainDamage],
  }),
);
/** "Resource: Remove 1 power counter from Force → generate a [wild] resource." */
const BOND_RESOURCE = stubAbility(
  "bond.resource",
  def({
    trigger: { kind: "resource" },
    cost: { spendCounters: { counterType: "power", amount: 1, target: FORCE_REF } },
    generates: 1,
    effects: [],
  }),
);
/** "Forced Response: After the last power counter is removed from here, deal 1 damage to your identity." */
const FORCE_LAST = stubAbility(
  "force.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "countersRemoved", selfIs: "target", eventIs: { counterType: "power" }, eventAtMost: { remaining: 0 } },
    },
    effects: [
      {
        kind: "dealDamage",
        target: { kind: "identityOf", player: { kind: "controller" } },
        amount: { kind: "const", value: 1 },
      },
    ],
  }),
);
/** As `BOND_ACTION`, from "each upgrade": a ref that can name more than one card. */
const BOND_EACH = stubAbility(
  "bond.each-action",
  def({
    trigger: { kind: "action" },
    cost: {
      spendCounters: { counterType: "power", amount: 1, target: { kind: "each", query: { categories: ["upgrade"] } } },
    },
    effects: [villainDamage],
  }),
);
const BOND = stubSupport({ id: "bond", cost: 0, abilities: [BOND_ACTION.ref, BOND_RESOURCE.ref, BOND_EACH.ref] });
const FORCE = stubUpgrade({ id: "force", cost: 0, abilities: [FORCE_LAST.ref] });
/** "Action: deal 1 damage to the villain." for 1. */
const ZAP_ACTION = stubAbility("zap.action", def({ trigger: { kind: "action" }, effects: [villainDamage] }));
const ZAP = stubEvent({ id: "zap", cost: 1, abilities: [ZAP_ACTION.ref] });
const deps: EngineDeps = depsOf(BOND_ACTION, BOND_RESOURCE, BOND_EACH, FORCE_LAST, ZAP_ACTION);

interface Board {
  readonly state: GameState;
  readonly bond: InstanceId;
  readonly force: InstanceId;
  readonly zap: InstanceId;
}

/** p1 with Bond and `forces` copies of Force in play, each holding `power` counters, and Zap in hand. */
function start(power: number, forces = 1): Board {
  const base = gameAtFirstTurn({ cards: [BOND, FORCE, ZAP], deps, deck: [BOND.id, FORCE.id, FORCE.id, ZAP.id] });
  const bond = playerCardIntoPlay(base, BOND.id);
  let state = bond.state;
  const ids: InstanceId[] = [];
  for (let i = 0; i < forces; i++) {
    const force = playerCardIntoPlay(state, FORCE.id);
    ids.push(force.id);
    const instance = mustInstance(force.state, force.id);
    state = {
      ...force.state,
      instances: { ...force.state.instances, [force.id]: { ...instance, counters: power > 0 ? { power } : {} } },
    };
  }
  const zap = giveCard(state, P1, ZAP.id);
  return { state: zap.state, bond: bond.id, force: ids[0]!, zap: zap.id };
}

const useBond = (bond: InstanceId, ability = BOND_ACTION): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: bond,
  abilityId: ability.ref.id,
  payment: [],
});
const playZapWithBond = ({ bond, zap }: Board): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: zap,
  payment: [{ ability: { instanceId: bond, abilityId: BOND_RESOURCE.ref.id } }],
  attachToInstanceId: null,
});
const power = (state: GameState, id: InstanceId): number => mustInstance(state, id).counters.power ?? 0;
const identityOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
/** The damage dealt, in log order, as "identity" or "villain". */
const damageOrder = (state: GameState, events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) =>
    e.type === "damageDealt" ? [e.targetInstanceId === identityOf(state) ? "identity" : "villain"] : [],
  );
const expectReplays = (session: { readonly state: GameState; readonly log: Parameters<typeof replay>[0] }) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("§3.85 'Remove 1 power counter from Phoenix Force →': a counter cost paid from another card", () => {
  it("removes the counter from the card the ref names, not the ability's own; replay deep-equal", () => {
    const board = start(2);
    const { session, events } = driveSession(startSession(board.state), deps, [useBond(board.bond)]);
    expect(power(session.state, board.force)).toBe(1);
    expect(mustInstance(session.state, board.bond).counters.power ?? 0).toBe(0);
    expect(damageOrder(session.state, events)).toEqual(["villain"]);
    expectReplays(session);
  });

  it("is refused with too few counters, with the named card out of play, and when the ref names two cards", () => {
    const none = start(0);
    const refused = applyCommand(none.state, useBond(none.bond), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("insufficient_resources");
    const actions = legalActions(none.state, P1, deps);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === none.bond)).toBe(false);

    const gone = start(2);
    const withoutForce: GameState = {
      ...gone.state,
      players: gone.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gone.force) } : p,
      ),
    };
    const outOfPlay = applyCommand(withoutForce, useBond(gone.bond), deps);
    expect(outOfPlay.ok).toBe(false);
    if (!outOfPlay.ok) expect(outOfPlay.error.code).toBe("no_valid_target");

    const two = start(2, 2);
    const one = start(2);
    expect(applyCommand(one.state, useBond(one.bond, BOND_EACH), deps).ok).toBe(true);
    const ambiguous = applyCommand(two.state, useBond(two.bond, BOND_EACH), deps);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) expect(ambiguous.error.code).toBe("invalid_choice");
  });

  it("removing the last counter answers 'after the last power counter is removed from here', before the effects", () => {
    const board = start(1);
    const { session, events } = driveSession(startSession(board.state), deps, [useBond(board.bond)]);
    expect(power(session.state, board.force)).toBe(0);
    // The forced response (1 to the identity) resolves before the ability it paid for (1 to the villain).
    expect(damageOrder(session.state, events)).toEqual(["identity", "villain"]);
    const announced = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "countersRemoved" ? [e.event] : [],
    );
    expect(announced).toEqual([
      {
        kind: "countersRemoved",
        instanceId: board.force,
        counterType: "power",
        amount: 1,
        remaining: 0,
        paidAsCost: true,
      },
    ]);
    // Removed once: by the cost, not again by the announcement.
    expect(events.filter((e) => e.type === "counterRemoved")).toHaveLength(1);
    expectReplays(session);
  });

  it("as a resource ability's cost, the response still resolves before the card it paid for", () => {
    const board = start(1);
    const { session, events } = driveSession(startSession(board.state), deps, [playZapWithBond(board)]);
    expect(power(session.state, board.force)).toBe(0);
    expect(mustPlayer(session.state, P1).discard).toContain(board.zap);
    expect(damageOrder(session.state, events)).toEqual(["identity", "villain"]);
    expectReplays(session);
  });

  it("a counter still left answers nothing", () => {
    const board = start(3);
    const { session, events } = driveSession(startSession(board.state), deps, [playZapWithBond(board)]);
    expect(power(session.state, board.force)).toBe(2);
    expect(damageOrder(session.state, events)).toEqual(["villain"]);
  });
});
