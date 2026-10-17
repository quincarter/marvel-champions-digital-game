import { describe, expect, test } from "vitest";
import type { GameEvent, PlayerId } from "@mc/engine";
import { refilledHand } from "./sound-effects.js";

const refill = (drawn: number): GameEvent =>
  ({ type: "handRefilled", playerId: "p1" as PlayerId, drawn, handSize: 6 }) as GameEvent;

describe("refilledHand", () => {
  test("a refill that drew cards", () => {
    expect(refilledHand([refill(3)])).toBe(true);
  });

  test("a hand already full draws nothing, and makes no sound", () => {
    expect(refilledHand([refill(0)])).toBe(false);
    expect(refilledHand([])).toBe(false);
  });
});
