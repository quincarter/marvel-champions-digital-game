import { describe, expect, it } from "vitest";
import {
  P1,
  P2,
  answer,
  endTurn,
  firstLegal,
  inst,
  settleUntil,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { WAVE2_DEPS } from "../index.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game } from "../testing.js";

/**
 * RRG 1.8 "Each Player" (p. 17), docs/phase7-wave11-scenarios.md §S7 E29: Hunting Down Heroes (04096b) says "each
 * hero must choose ... place 1 threat on Hunting Down Heroes or take 1 damage" with no order printed, so the first
 * player orders the heroes, and the heroes later in that order choose seeing the threat the earlier ones placed.
 */
describe("Hunting Down Heroes (04096b): the first player orders the heroes", () => {
  it("asks the first player for the order, then the second chooser sees the first chooser's threat already placed", () => {
    const start = startWave2Game(
      wave2Scenario("taskmaster", {
        players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "core-captain-marvel-leadership" }],
        seed: 2026,
      }),
    );
    const scheme = start.mainScheme.instanceId;
    const stacked = stackEncounterDeck(start, "01186", "01188");
    const heroes = runWave2(stacked, toHero(P1), endTurn(P1), toHero(P2), endTurn(P2));
    const asked = settleUntil(heroes, "orderPlayers", firstLegal, WAVE2_DEPS);
    expect(asked.pendingChoice?.prompt).toEqual({ kind: "orderPlayers", reason: "forEachPlayer" });
    expect(asked.pendingChoice?.playerId).toBe(asked.firstPlayerId);
    const threatAtOrder = inst(asked, scheme).threat;

    // The second player goes first: they are asked first, and place threat.
    const second = answer(asked, [P2, P1], WAVE2_DEPS);
    expect(second.pendingChoice?.playerId).toBe(P2);
    expect(inst(second, scheme).threat).toBe(threatAtOrder);
    expect(second.pendingChoice?.options[0]?.label).toBe("Place 1 threat here");
    const next = answer(second, [second.pendingChoice!.options[0]!.optionId], WAVE2_DEPS);
    // The first player then chooses, with that threat already on the scheme.
    expect(next.pendingChoice?.playerId).toBe(P1);
    expect(inst(next, scheme).threat).toBe(threatAtOrder + 1);
  });
});
