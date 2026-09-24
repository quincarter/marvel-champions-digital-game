/**
 * docs/phase7-wave3.md §3.25: a variable resource cost of any type, with a maximum — Nebula's Ship (`gmw` 16093):
 * "Shoot the Thrusters! — First Player Action: Exhaust the Milano and spend up to 2 resources of any type → remove 1
 * evasion counter from here for each resource spent this way."
 *
 * Sources: RRG 1.8 "Cost" (p. 13: overpaying is legal), "Non-Numerical Variable" (p. 30).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEnvironment } from "./testing/fixtures.js";
import { fromHand, RESOURCE } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const THRUSTERS = stubAbility("ship.action", {
  trigger: { kind: "action", firstPlayerOnly: true },
  cost: { resourcesX: { resource: "any", bind: "x", max: 2 } },
  effects: [{ kind: "removeCounters", target: self, counterType: "evasion", amount: { kind: "var", name: "x" } }],
});
const SHIP = stubEnvironment({ id: "ship", abilities: [THRUSTERS.ref] });

const deps: EngineDeps = depsOf(THRUSTERS);

function start(): { state: GameState; ship: InstanceId } {
  const placed = encounterCardInVillainArea(gameAtFirstTurn({ cards: [SHIP], deps, encounter: [SHIP.id] }), SHIP.id);
  return {
    ship: placed.id,
    state: {
      ...placed.state,
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), counters: { evasion: 5 } },
      },
    },
  };
}

/** Uses the ship's action paying with `count` resource cards (each prints one wild resource) from p1's hand. */
function useWith(count: number) {
  const { state, ship } = start();
  const cards = mustPlayer(state, P1)
    .hand.filter((id) => state.instances[id]?.cardId === RESOURCE.id)
    .slice(0, count);
  if (cards.length < count) throw new Error("not enough resource cards in hand");
  const result = applyCommand(
    state,
    {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: ship,
      abilityId: THRUSTERS.ref.id,
      payment: fromHand(...cards),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return mustInstance(result.state, ship).counters["evasion"];
}

describe("§3.25 'spend up to 2 resources of any type'", () => {
  it("X is the number of resources spent", () => {
    expect(useWith(1)).toBe(4);
    expect(useWith(2)).toBe(3);
  });

  it("paying more is legal, but X stops at the maximum", () => {
    expect(useWith(3)).toBe(3);
  });

  it("spending none is 'up to 2' too, and does nothing", () => {
    expect(useWith(0)).toBe(5);
  });
});
