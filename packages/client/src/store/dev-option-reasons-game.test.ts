import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { unavailableOptionReasons } from "../view/ability-refusal.js";
import { playToNickFuryChoice } from "./dev-option-reasons-game.js";
import { SessionStore } from "./session-store.js";

describe("the option-reasons dev game (#412)", () => {
  test("Nick Fury's choice offers two options and names the barred one", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await playToNickFuryChoice(store);
    expect(store.state.error).toBeNull();
    const choice = store.state.game!.pendingChoice!;
    expect(choice.prompt.kind).toBe("chooseOption");
    expect(choice.options.map((option) => option.label)).toEqual(["Draw 3 cards", "Deal 4 damage to an enemy"]);
    expect(choice.prompt.kind === "chooseOption" ? choice.prompt.unavailable?.options : null).toEqual([
      { index: 0, label: "Remove 2 threat from a scheme", reason: "condition" },
    ]);
  }, 120_000);
});

describe("the barred option's reason, in words (#412)", () => {
  test("Nick Fury's threat option says no scheme has threat on it", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await playToNickFuryChoice(store);
    const game = store.state.game!;
    const prompt = game.pendingChoice!.prompt;
    expect(prompt.kind === "chooseOption" && prompt.unavailable).toBeTruthy();
    if (prompt.kind !== "chooseOption" || !prompt.unavailable) return;
    expect(unavailableOptionReasons(game, prompt.unavailable, POOL_DEPS)).toEqual([
      { index: 0, label: "Remove 2 threat from a scheme", why: "no scheme has threat on it" },
    ]);
  }, 120_000);
});
