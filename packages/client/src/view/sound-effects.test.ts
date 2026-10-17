import { describe, expect, test } from "vitest";
import type { Command, GameEvent, PlayerId } from "@mc/engine";
import { madeBasicAttack, refilledHand } from "./sound-effects.js";

const refill = (drawn: number): GameEvent =>
  ({ type: "handRefilled", playerId: "p1" as PlayerId, drawn, handSize: 6 }) as GameEvent;

describe("madeBasicAttack", () => {
  test("the Attack button", () => {
    expect(madeBasicAttack({ type: "basicAttack" } as Command, [])).toBe(true);
  });

  test("a card that has a character make one", () => {
    const instructed = { type: "basicPowerInstructed", power: "attack" } as GameEvent;
    const thwart = { type: "basicPowerInstructed", power: "thwart" } as GameEvent;
    expect(madeBasicAttack(undefined, [instructed])).toBe(true);
    expect(madeBasicAttack(undefined, [thwart])).toBe(false);
  });

  test("anything else is no attack", () => {
    expect(madeBasicAttack({ type: "basicThwart" } as Command, [])).toBe(false);
    expect(madeBasicAttack(undefined, [])).toBe(false);
  });
});

describe("refilledHand", () => {
  test("a refill that drew cards", () => {
    expect(refilledHand([refill(3)])).toBe(true);
  });

  test("a hand already full draws nothing, and makes no sound", () => {
    expect(refilledHand([refill(0)])).toBe(false);
    expect(refilledHand([])).toBe(false);
  });
});
