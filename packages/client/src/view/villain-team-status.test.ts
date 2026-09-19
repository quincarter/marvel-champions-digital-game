import { CORE_DEPS } from "@mc/cards";
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { teamStatusOf } from "./villain-team-status.js";

describe("teamStatusOf", () => {
  test("one row per seat, in table order, none targeted when no target is given", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({ scenarioId: "rhino", difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 });
    const state = store.state.game!;

    const rows = teamStatusOf(state, CORE_DEPS, null);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.seat.playerId).toBe(state.players[0]!.playerId);
    expect(rows[0]!.seat.hp).not.toBeNull();
    expect(rows[0]!.targeted).toBe(false);
  });

  test("marks exactly the seat matching the given target, and nobody else", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({ scenarioId: "rhino", difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 2026 });
    const state = store.state.game!;
    const playerId = state.players[0]!.playerId;

    const rows = teamStatusOf(state, CORE_DEPS, playerId);

    expect(rows.find((r) => r.seat.playerId === playerId)?.targeted).toBe(true);
  });
});
