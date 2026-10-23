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
    expect(preview).toMatchObject({ incoming: 2, prevented: 2 });
    // Read off the engine resolving the window on a copy: Rhino's 2 would take Spider-Man from 10 to 8.
    expect(preview.hp).toEqual({ targetName: "Spider-Man", now: 10, ifResolves: 8, withInterrupt: 10 });
    expect(preventedAmountLine(preview)).toBe("2 damage");
  }, 60_000);

  test("a tough status card would take the hit, so letting it resolve keeps the hit points too", async () => {
    const { game, option } = await backflipWindow();
    const target = game.players[0]!.identity.instanceId;
    const instance = game.instances[target]!;
    const tough = {
      ...game,
      instances: { ...game.instances, [target]: { ...instance, statuses: { ...instance.statuses, tough: 1 } } },
    };
    expect(preventionPreviewOf(tough, POOL_DEPS, option)!.hp).toMatchObject({ now: 10, ifResolves: 10 });
  }, 60_000);

  test("a partial prevention is resolved by the engine with what it leaves", async () => {
    const { game, option } = await backflipWindow();
    const choice = game.pendingChoice!;
    if (choice.prompt.kind !== "chooseTriggers" || choice.prompt.event.kind !== "dealDamage") throw new Error("window");
    // Backflip is all-or-nothing, so a 1-damage copy of the same window stands in for "prevent 1 of 2" here: the
    // engine's answer for 1 left must be 9.
    const event = choice.prompt.event;
    const one = {
      ...game,
      stack: game.stack.map((f) =>
        f.kind === "event" && f.event === event ? { ...f, event: { ...event, amount: 1 } } : f,
      ),
      pendingChoice: { ...choice, prompt: { ...choice.prompt, event: { ...event, amount: 1 } } },
    };
    expect(preventionPreviewOf(one, POOL_DEPS, option)!.hp).toMatchObject({
      now: 10,
      ifResolves: 9,
      withInterrupt: 10,
    });
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
