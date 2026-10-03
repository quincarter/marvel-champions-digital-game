/**
 * `PlayerRef orElse`: `first` when it names anyone, else `otherwise`. The Search for Spiral (`mojo` 39016) reveals for
 * "the player who removed that threat", and when no player removed it (an encounter card's forced removal) the first
 * player does (owner decision Q64). `cards` drives the card itself in `wave6/mojo/spiral.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS } from "./abilities.js";
import { resolvePlayers, type EffectContext } from "./select.js";
import type { PlayerRef } from "./spec.js";
import type { TriggerEvent } from "./trigger-events.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const REMOVER_ELSE_FIRST: PlayerRef = {
  kind: "orElse",
  first: { kind: "eventPlayer" },
  otherwise: { kind: "firstPlayer" },
};

const removal = (playerId: typeof P1 | null): TriggerEvent =>
  ({ kind: "removeThreat", schemeInstanceId: "x", amount: 1, sourceInstanceId: null, playerId }) as TriggerEvent;

describe("PlayerRef orElse", () => {
  const state = gameAtFirstTurn({ players: 2, cards: [], deps: DEFAULT_DEPS });
  const context = (event: TriggerEvent | null): EffectContext => ({
    selfInstanceId: null,
    controllerId: null,
    event,
    bindings: {},
    deps: DEFAULT_DEPS,
  });

  it("names the first ref's player when it names one", () => {
    expect(resolvePlayers(state, REMOVER_ELSE_FIRST, context(removal(P2)))).toEqual([P2]);
  });

  it("falls back to the other ref when the first names nobody: a removal no player made, or no event", () => {
    expect(state.firstPlayerId).toBe(P1);
    expect(resolvePlayers(state, REMOVER_ELSE_FIRST, context(removal(null)))).toEqual([P1]);
    expect(resolvePlayers(state, REMOVER_ELSE_FIRST, context(null))).toEqual([P1]);
  });

  it("names nobody when neither does", () => {
    const neither: PlayerRef = { kind: "orElse", first: { kind: "eventPlayer" }, otherwise: { kind: "controller" } };
    expect(resolvePlayers(state, neither, context(removal(null)))).toEqual([]);
  });
});
