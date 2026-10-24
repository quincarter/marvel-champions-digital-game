import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { startDamageInterruptGame } from "../store/dev-damage-interrupt-game.js";
import { SessionStore } from "../store/session-store.js";
import { preventedAmountLine, preventionPreviewOf } from "./interrupt-prevention.js";
import { inlineInterruptFor } from "./villain-walkthrough.js";

/** The window's damage event changed on its own stack frame, and on the prompt, as one copy of the game. */
function withWindowEvent(game: GameState, change: { readonly amount?: number; readonly unpreventable?: true }) {
  const choice = game.pendingChoice!;
  const window = game.stack.find((f) => f.frameId === choice.frameId);
  const eventFrameId = window?.kind === "window" ? window.eventFrameId : null;
  const stack = game.stack.map((f) =>
    f.frameId === eventFrameId && f.kind === "event" && f.event.kind === "dealDamage"
      ? { ...f, event: { ...f.event, ...change } }
      : f,
  );
  if (choice.prompt.kind !== "chooseTriggers" || choice.prompt.event.kind !== "dealDamage") throw new Error("window");
  const prompt = { ...choice.prompt, event: { ...choice.prompt.event, ...change } };
  return { ...game, stack, pendingChoice: { ...choice, prompt } } as GameState;
}

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

  test("a partial prevention says how much of the damage", () => {
    expect(preventedAmountLine({ incoming: 3, prevented: 1 })).toBe("1 of 3 damage");
  });

  test("nothing against unpreventable damage, which the engine will not prevent", async () => {
    const { game, option } = await backflipWindow();
    expect(preventionPreviewOf(withWindowEvent(game, { unpreventable: true }), POOL_DEPS, option)).toBeNull();
  }, 60_000);

  test("reads the live amount off the event's frame, as an earlier interrupt in the window left it", async () => {
    const { game, option } = await backflipWindow();
    // The prompt still says 2 (the window opened on 2); the event's frame says 1, as a "prevent 1" already answered.
    const choice = game.pendingChoice!;
    const live = { ...withWindowEvent(game, { amount: 1 }), pendingChoice: choice };
    expect(preventionPreviewOf(live, POOL_DEPS, option)).toMatchObject({
      incoming: 1,
      prevented: 1,
      hp: { now: 10, ifResolves: 9, withInterrupt: 10 },
    });
  }, 60_000);

  test("nothing outside a damage window", async () => {
    const { game, option } = await backflipWindow();
    expect(preventionPreviewOf({ ...game, pendingChoice: null }, POOL_DEPS, option)).toBeNull();
  }, 60_000);
});
