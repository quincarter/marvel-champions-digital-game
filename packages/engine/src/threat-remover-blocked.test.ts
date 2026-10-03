/**
 * Owner decision Q66 = A (wave 6): a player using an encounter card's own action to remove threat (The Search for
 * Spiral's "Hero Action: Take 2 damage → remove 3 threat from here", `mojo` 39016, shaped here as an environment whose
 * action removes threat from the main scheme) is the player removing it (`removeThreat.playerId`), so crisis icons and
 * player-scoped "threat cannot be removed" rules stop it as they stop any other player removal.
 *
 * Sources: RRG 1.8 "Crisis Icon" (p. 14): "While at least one crisis icon is in play, threat cannot be removed from
 * the main scheme by player cards. … Abilities on encounter cards are not affected by the crisis icon." Q66 reads the
 * icon summary ("A crisis icon prevents players from removing threat from the main scheme", RRG 1.8 "Icons") for the
 * encounter card a player uses; an encounter card's forced ability names no player and is never stopped.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubSideScheme } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const MAIN = { kind: "mainScheme" } as const;

/** An environment: "Hero Action: Remove 3 threat from the main scheme." */
const BEACON_ACTION = stubAbility("beacon.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "removeThreat", target: MAIN, amount: n(3) }],
});
const BEACON = stubEnvironment({ id: "beacon", abilities: [BEACON_ACTION.ref] });

/** A side scheme with a crisis icon. */
const SIEGE = stubSideScheme({ id: "siege", startingThreat: 10, icons: ["crisis"] });

/** An environment: "Forced Response: After threat is removed from a side scheme, remove 2 threat from the main scheme." */
const EBB_FORCED = stubAbility(
  "ebb.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "removeThreat", targetIs: { categories: ["sideScheme"] } } },
    effects: [{ kind: "removeThreat", target: MAIN, amount: n(2) }],
  }),
);
const EBB = stubEnvironment({ id: "ebb", abilities: [EBB_FORCED.ref] });

/** An environment: "P1 cannot remove threat from the main scheme." (a player-scoped rule, docs/phase7-wave3.md §3.26) */
const WARD_CONSTANT = stubAbility("ward.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "threatCannotBeRemoved", target: { categories: ["mainScheme"] }, player: { kind: "id", playerId: P1 } },
    ],
  },
  effects: [],
});
const WARD = stubEnvironment({ id: "ward", abilities: [WARD_CONSTANT.ref] });

/** A player event: "Remove 3 threat from the main scheme." */
const RELIEF_ACTION = stubAbility("relief.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "removeThreat", target: MAIN, amount: n(3) }],
});
const RELIEF = stubEvent({ id: "relief", cost: 0, abilities: [RELIEF_ACTION.ref] });

const deps: EngineDeps = depsOf(BEACON_ACTION, EBB_FORCED, WARD_CONSTANT, RELIEF_ACTION);

/** Two players in hero form, the main scheme at 8 threat, the beacon in play, and these encounter cards too. */
function start(...extra: readonly (typeof SIEGE | typeof EBB)[]): { readonly state: GameState; beacon: InstanceId } {
  const base = gameAtFirstTurn({
    players: 2,
    cards: [BEACON, SIEGE, EBB, WARD, RELIEF],
    deps,
    deck: [RELIEF.id],
    encounter: [BEACON.id, SIEGE.id, EBB.id, WARD.id],
  });
  const main = base.mainScheme.instanceId;
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 8 } },
  };
  const beacon = encounterCardInVillainArea(heroes, BEACON.id);
  const state = extra.reduce(
    (s, card) => encounterCardInVillainArea(s, card.id, card === SIEGE ? 10 : 0).state,
    beacon.state,
  );
  return { state, beacon: beacon.id };
}

const run = (state: GameState, ...commands: readonly Command[]) => {
  const { session, events } = driveSession(startSession(state), deps, commands);
  return { state: session.state, events };
};
const use = (player: PlayerId, card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: player,
  cardInstanceId: card,
  abilityId: ability.ref.id,
  payment: [],
});
const asActive = (state: GameState, player: PlayerId) =>
  player === P1 ? state : run(state, { type: "endTurn", playerId: P1 }).state;
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const blocks = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatRemovalBlocked" ? [e.reason] : []));

describe("a player using an encounter card's action is stopped like any player (owner decision Q66)", () => {
  it("control: with no crisis icon in play the encounter card's action removes 3 threat from the main scheme", () => {
    const { state, beacon } = start();
    const after = run(state, use(P1, beacon, BEACON_ACTION));
    expect(mainThreat(after.state)).toBe(5);
    expect(blocks(after.events)).toEqual([]);
  });

  it("a crisis icon in play stops the encounter card's Hero Action, whichever player uses it", () => {
    for (const player of [P1, P2]) {
      const { state: base, beacon } = start(SIEGE);
      const state = asActive(base, player);
      const after = run(state, use(player, beacon, BEACON_ACTION));
      expect(mainThreat(after.state)).toBe(8);
      expect(blocks(after.events)).toEqual(["crisis"]);
    }
  });

  it("an encounter card's own forced removal is not stopped by the crisis icon (RRG 1.8 p. 14)", () => {
    const { state } = start(SIEGE, EBB);
    const siege = state.villainArea.find((id) => mustInstance(state, id).cardId === SIEGE.id)!;
    const after = run(state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: mustPlayer(state, P1).identity.instanceId,
      schemeInstanceId: siege,
    });
    expect(mustInstance(after.state, siege).threat).toBeLessThan(10);
    expect(mainThreat(after.state)).toBe(6);
    expect(blocks(after.events)).toEqual([]);
  });

  it("a player card's removal is stopped by the crisis icon, as before: with no valid target it cannot be played", () => {
    const { state } = start(SIEGE);
    const given = giveCard(state, P1, RELIEF.id);
    const play: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    };
    const result = applyCommand(given.state, play, deps);
    expect(result.ok).toBe(false);
    // Without the crisis icon it is played and removes its 3 threat.
    const clear = giveCard(start().state, P1, RELIEF.id);
    expect(mainThreat(run(clear.state, { ...play, cardInstanceId: clear.id }).state)).toBe(5);
  });

  it("a rule that P1 cannot remove threat from the main scheme stops P1's use of the action, not P2's", () => {
    for (const [player, expected] of [
      [P1, 8],
      [P2, 5],
    ] as const) {
      const { state: base, beacon } = start();
      const warded = encounterCardInVillainArea(base, WARD.id).state;
      const state = asActive(warded, player);
      const after = run(state, use(player, beacon, BEACON_ACTION));
      expect(mainThreat(after.state)).toBe(expected);
      expect(blocks(after.events)).toEqual(player === P1 ? ["rule"] : []);
    }
  });
});
