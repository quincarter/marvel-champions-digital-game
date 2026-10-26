import { describe, expect, test } from "vitest";
import { createPressGuard, PRESS_GUARD_FRAMES } from "./pad-press-guard.js";

describe("pad press guard", () => {
  test("a screen never held takes every press", () => {
    const guard = createPressGuard();
    expect(guard.allows(0, 9)).toBe(true);
    expect(guard.allows(500, 9)).toBe(true);
  });

  test("a down in the frame after the owner closed is that owner's press, not the screen's", () => {
    const guard = createPressGuard();
    guard.noteHeld(204, [9]);
    expect(guard.allows(205, 9)).toBe(false);
    expect(guard.allows(204 + PRESS_GUARD_FRAMES, 9)).toBe(false);
  });

  test("a press a few frames later is a new one and goes through", () => {
    const guard = createPressGuard();
    guard.noteHeld(204, [9]);
    expect(guard.allows(204 + PRESS_GUARD_FRAMES + 1, 9)).toBe(true);
  });

  test("a screen held for many frames only opens up after the last one", () => {
    const guard = createPressGuard();
    for (let frame = 10; frame <= 100; frame++) guard.noteHeld(frame, [9]);
    expect(guard.allows(101, 9)).toBe(false);
    expect(guard.allows(103, 9)).toBe(true);
  });

  test("a button that was up while the screen was held is a new press, even in the next frame", () => {
    const guard = createPressGuard();
    guard.noteHeld(204, [9]);
    expect(guard.allows(205, 0)).toBe(true);
    guard.noteHeld(300, []);
    expect(guard.allows(301, 9)).toBe(true);
  });

  test("an older held frame never pulls the window back", () => {
    const guard = createPressGuard();
    guard.noteHeld(50, [9]);
    guard.noteHeld(20, [9]);
    expect(guard.allows(51, 9)).toBe(false);
  });
});
