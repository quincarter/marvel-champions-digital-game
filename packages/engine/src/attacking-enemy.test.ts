/**
 * docs/phase7-wave4.md §3.34: "the attacking enemy" from a trigger that is not the attack's own (Flow Like Water,
 * `vision` 26016). The in-attack case is driven in a real game (`packages/cards/src/wave4/vision/vision-pack-cards.test.ts`,
 * Mass Increase during Rhino's attack); here, the two edges of the ref.
 */

import { describe, expect, it } from "vitest";
import { resolveRef } from "./select.js";
import type { GameState } from "./state.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";
import { NO_ABILITIES } from "./abilities.js";

const deps = { abilities: NO_ABILITIES };
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

describe("§3.34 the attacking enemy", () => {
  it("names nothing outside an attack", () => {
    const state = gameAtFirstTurn({ cards: [], deps });
    expect(resolveRef(state, { kind: "attackingEnemy" }, context)).toEqual([]);
  });

  it("names the enemy of the innermost attack in progress, while it is in play", () => {
    const state = gameAtFirstTurn({ cards: [], deps });
    const villain = state.activeVillainId;
    const attacking: GameState = {
      ...state,
      stack: [
        {
          frameId: "f-attack" as never,
          kind: "event",
          event: {
            kind: "enemyAttack",
            enemyInstanceId: villain,
            attackedPlayerId: P1,
            targetPlayerId: P1,
            targetInstanceId: state.players[0]!.identity.instanceId,
          },
          stage: "apply",
          vars: {},
          slots: {},
        } as never,
        ...state.stack,
      ],
    };
    expect(resolveRef(attacking, { kind: "attackingEnemy" }, context)).toEqual([villain]);
  });
});
