import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { startDamageInterruptGame } from "../store/dev-damage-interrupt-game.js";
import { SessionStore } from "../store/session-store.js";
import { preventedAmountLine, preventionPreviewOf } from "./interrupt-prevention.js";
import { inlineInterruptFor } from "./villain-walkthrough.js";

async function backflipWindow() {
  const store = new SessionStore(new LocalEngineHost());
  const finish = await startDamageInterruptGame(store);
  await finish();
  const game = store.state.game!;
  const option = inlineInterruptFor(game.pendingChoice!, game.players[0]!.playerId)![0]!;
  return { game, option };
}

describe("preventionPreviewOf (#394)", () => {
  test("Backflip prevents all of Rhino's damage", async () => {
    const { game, option } = await backflipWindow();
    const preview = preventionPreviewOf(game, POOL_DEPS, option)!;
    expect(preview).toEqual({ incoming: 2, prevented: 2 });
    expect(preventedAmountLine(preview)).toBe("2 damage");
  }, 60_000);

  test("a partial prevention says how much of the damage", () => {
    expect(preventedAmountLine({ incoming: 3, prevented: 1 })).toBe("1 of 3 damage");
  });

  test("nothing against unpreventable damage, which the engine will not prevent", async () => {
    const { game, option } = await backflipWindow();
    const choice = game.pendingChoice!;
    if (choice.prompt.kind !== "chooseTriggers" || choice.prompt.event.kind !== "dealDamage") throw new Error("window");
    const unpreventable = {
      ...game,
      pendingChoice: {
        ...choice,
        prompt: { ...choice.prompt, event: { ...choice.prompt.event, unpreventable: true as const } },
      },
    };
    expect(preventionPreviewOf(unpreventable, POOL_DEPS, option)).toBeNull();
  }, 60_000);

  test("nothing outside a damage window", async () => {
    const { game, option } = await backflipWindow();
    expect(preventionPreviewOf({ ...game, pendingChoice: null }, POOL_DEPS, option)).toBeNull();
  }, 60_000);
});
