import { describe, expect, test } from "vitest";
import { createPressGuard, PRESS_GUARD_FRAMES } from "./pad-press-guard.js";

describe("pad press guard", () => {
  test("a screen never held takes every press", () => {
    const guard = createPressGuard();
    expect(guard.allows(0)).toBe(true);
    expect(guard.allows(500)).toBe(true);
  });

  test("a down in the frame after the owner closed is that owner's press, not the screen's", () => {
    const guard = createPressGuard();
    guard.noteHeld(204);
    expect(guard.allows(205)).toBe(false);
    expect(guard.allows(204 + PRESS_GUARD_FRAMES)).toBe(false);
  });

  test("a press a few frames later is a new one and goes through", () => {
    const guard = createPressGuard();
    guard.noteHeld(204);
    expect(guard.allows(204 + PRESS_GUARD_FRAMES + 1)).toBe(true);
  });

  test("a screen held for many frames only opens up after the last one", () => {
    const guard = createPressGuard();
    for (let frame = 10; frame <= 100; frame++) guard.noteHeld(frame);
    expect(guard.allows(101)).toBe(false);
    expect(guard.allows(103)).toBe(true);
  });

  test("an older held frame never pulls the window back", () => {
    const guard = createPressGuard();
    guard.noteHeld(50);
    guard.noteHeld(20);
    expect(guard.allows(51)).toBe(false);
  });
});
