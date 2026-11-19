/**
 * Issue #856's dev game (`dev-power-man-chi-game.ts`) still plays forward to Power Man (21012) in play with 2 chi
 * counters and his "any number of chi counters" Action legal with a count from 1 to 2. The e2e spec that drives it is a
 * local gate, so this is what catches an engine or content change that breaks the replayed commands.
 */
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POWER_MAN_CHI_INSTANCE, startPowerManChiDevGame } from "./dev-power-man-chi-game.js";
import { SessionStore } from "./session-store.js";

describe("the #856 Power Man dev game", () => {
  test("stops with Power Man's chi Action asking for 1 or 2 counters", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startPowerManChiDevGame(store);
    const game = store.state.game!;
    expect(game.instances[POWER_MAN_CHI_INSTANCE]!.cardId).toBe("21012");
    expect(game.instances[POWER_MAN_CHI_INSTANCE]!.counters.chi).toBe(2);
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected the player's turn");
    const use = legal.legal.find(
      (entry) =>
        entry.action.kind === "useAbility" &&
        entry.action.instanceId === POWER_MAN_CHI_INSTANCE &&
        entry.action.abilityId === "21012.power-man-action",
    );
    expect(use?.costCounters).toEqual({ min: 1, max: 2 });
  });
});
