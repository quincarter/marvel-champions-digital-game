/**
 * "Any player may trigger this ability" (`triggerableBy: { kind: "each" }`, docs/phase7-wave6.md §3.11) read for a
 * card in a two-team game and in cooperative ones. Two teams: every player of either team (High-Tech Suit 56131; rules
 * expert, docs/competitive-mode-plan.md §1.10), the inactive-team gate still judging when. Cooperative: every player at
 * the table, or with split game areas (Kang) each player in the card's own area (game-areas.test.ts), unchanged.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_DEPS, type AbilityTriggerSpec } from "./abilities.js";
import { triggeringPlayers } from "./select.js";
import { newGame } from "./testing/scenario.js";
import { competitiveGame } from "./testing/team.js";
import type { GameState } from "./state.js";

const ANY_PLAYER: AbilityTriggerSpec = { kind: "action", triggerableBy: { kind: "each" } } as AbilityTriggerSpec;
const YOU: AbilityTriggerSpec = { kind: "action", triggerableBy: { kind: "controller" } } as AbilityTriggerSpec;

const seats = (state: GameState) => state.players.map((p) => p.playerId);
const firstIdentity = (state: GameState) => state.players[0]!.identity.instanceId;

describe("triggeringPlayers: 'any player may trigger'", () => {
  it("cooperative: every player at the table", () => {
    const state = newGame({ players: 3 });
    expect(triggeringPlayers(state, DEFAULT_DEPS, firstIdentity(state), ANY_PLAYER, null)).toEqual(seats(state));
  });

  it("two teams: every player of either team, though the card sits in one team's area", () => {
    const state = competitiveGame({ sizes: [2, 2] });
    expect(state.gameAreas).toHaveLength(2);
    expect(triggeringPlayers(state, DEFAULT_DEPS, firstIdentity(state), ANY_PLAYER, null)).toEqual(seats(state));
  });

  it("two teams: an ability naming its controller still names only them", () => {
    const state = competitiveGame({ sizes: [2, 2] });
    expect(triggeringPlayers(state, DEFAULT_DEPS, firstIdentity(state), YOU, null)).toEqual([
      state.players[0]!.playerId,
    ]);
  });
});
