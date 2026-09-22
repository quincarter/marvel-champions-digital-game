/**
 * docs/phase7-wave3.md §3.5: the patrol keyword. While a minion with it is engaged with a player, that player cannot
 * thwart the main scheme — neither with a basic thwart nor with a "(thwart)" ability — but other threat removal, and
 * thwarting a side scheme, still work. Synthetic cards shaped like Badoon Lieutenant, Kree Commando, Servant Bot and
 * Enraged Symbiote (`Patrol.`).
 *
 * Sources: RRG 1.8 "Patrol" (p. 32), "Thwart" (p. 44), "Crisis Icon" (p. 14); FAQ "Wasp (#1C)" (RRG 1.8 p. 61).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playFree,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const mainScheme: TargetRef = { kind: "mainScheme" };

const LIEUTENANT = stubMinion({ id: "lieutenant", atk: 2, sch: 2, hp: 6, keywords: [{ name: "patrol" }] });
const BYSTANDER = stubMinion({ id: "bystander", atk: 1, sch: 1, hp: 3 });
const SIDE = stubSideScheme({ id: "side", startingThreat: 3 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Hero Action (thwart): Remove 3 threat from the main scheme." — a thwart. */
const THWART_MAIN = actionEvent("thwart-main", [{ kind: "thwart", target: mainScheme, amount: n(3) }]);
/** "Remove 2 threat from the main scheme." — threat removal that is not a thwart. */
const REMOVE_MAIN = actionEvent("remove-main", [{ kind: "removeThreat", target: mainScheme, amount: n(2) }]);
/** Defeats every minion (so the patrol minion leaves). */
const SWEEP = actionEvent("sweep", [
  { kind: "dealDamage", target: { kind: "each", query: { categories: ["minion"] } }, amount: n(20) },
]);
const EVENTS = [THWART_MAIN, REMOVE_MAIN, SWEEP];

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const CARDS = [LIEUTENANT, BYSTANDER, SIDE, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [LIEUTENANT.id, BYSTANDER.id, SIDE.id, ...copiesOf(BYSTANDER.id, 20)];

/** Both players' identities in hero form, 5 threat on the main scheme, and the patrol minion engaged with `patrolled`. */
function start(patrolled: PlayerId | null, players: 1 | 2 = 1): GameState {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: ENCOUNTER,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    players,
  });
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    instances: {
      ...state.instances,
      [state.mainScheme.instanceId]: { ...mustInstance(state, state.mainScheme.instanceId), threat: 5 },
    },
  };
  if (patrolled) state = minionEngagedWith(state, LIEUTENANT.id, patrolled).state;
  return state;
}

const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const basicThwart = (player: PlayerId, scheme: InstanceId, state: GameState): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: mustPlayer(state, player).identity.instanceId,
  schemeInstanceId: scheme,
});

describe("§3.5 Patrol", () => {
  it("the engaged player cannot make a basic thwart against the main scheme", () => {
    const state = start(P1);
    const result = applyCommand(state, basicThwart(P1, state.mainScheme.instanceId, state), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("patrol");
  });

  it("…but may still thwart a side scheme", () => {
    const withSide = encounterCardInVillainArea(start(P1), SIDE.id, 3);
    const { session } = driveSession(startSession(withSide.state), deps, [
      basicThwart(P1, withSide.id, withSide.state),
    ]);
    expect(mustInstance(session.state, withSide.id).threat).toBeLessThan(3);
  });

  it("a '(thwart)' ability against the main scheme removes nothing, and the log says why", () => {
    const { state, events } = playFree(start(P1), deps, THWART_MAIN.card.id);
    expect(mainThreat(state)).toBe(5);
    expect(events).toContainEqual(expect.objectContaining({ type: "threatRemovalBlocked", reason: "patrol" }));
  });

  it("threat removal that is not a thwart still removes threat from the main scheme", () => {
    const { state } = playFree(start(P1), deps, REMOVE_MAIN.card.id);
    expect(mainThreat(state)).toBe(3);
  });

  it("a patrol minion engaged with another player restricts only that player", () => {
    const state = start(P2, 2);
    const { session } = driveSession(startSession(state), deps, [basicThwart(P1, state.mainScheme.instanceId, state)]);
    expect(mainThreat(session.state)).toBeLessThan(5);
    const blocked = applyCommand(state, basicThwart(P2, state.mainScheme.instanceId, state), deps);
    expect(blocked.ok).toBe(false);
  });

  it("once the patrol minion leaves play, the player may thwart the main scheme again", () => {
    const swept = playFree(start(P1), deps, SWEEP.card.id).state;
    const { session } = driveSession(startSession(swept), deps, [basicThwart(P1, swept.mainScheme.instanceId, swept)]);
    expect(mainThreat(session.state)).toBeLessThan(5);
  });

  it("a minion without the keyword restricts nothing", () => {
    const state = minionEngagedWith(start(null), BYSTANDER.id).state;
    const { state: after } = playFree(state, deps, THWART_MAIN.card.id);
    expect(mainThreat(after)).toBe(2);
  });
});
