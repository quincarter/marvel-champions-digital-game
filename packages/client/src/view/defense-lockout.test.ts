import { DEFENSE_BAR_MESSAGE, type GameState, type PlayerId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { defenseLockoutOf, isDefenseBarMessage, withDefenseLockout } from "./defense-lockout.js";
import type { Highlights } from "./highlights.js";

describe("defense lockout", () => {
  test("recognizes the engine's own bar wording and nothing else", () => {
    for (const message of Object.values(DEFENSE_BAR_MESSAGE)) expect(isDefenseBarMessage(message)).toBe(true);
    expect(isDefenseBarMessage("not enough resources")).toBe(false);
  });

  test("outside an enemy attack nobody is locked out and the marks pass through untouched", () => {
    const state = { stack: [], players: [] } as unknown as GameState;
    const viewer = "p1" as PlayerId;
    expect(defenseLockoutOf(state, viewer, POOL_DEPS)).toBeNull();
    const marks = { playable: new Set(), unplayable: new Map() } as unknown as Highlights;
    expect(withDefenseLockout(marks, state, viewer, POOL_DEPS)).toBe(marks);
  });
});
