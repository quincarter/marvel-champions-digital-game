/**
 * Gamepad → intent mapping. The risk here is a button silently meaning
 * nothing, or two buttons racing to mean two different things.
 */

import { describe, expect, test } from "vitest";
import { GAMEPAD_BUTTON, gamepadIntentFor, type GamepadIntent } from "./gamepad.js";

describe("gamepadIntentFor", () => {
  test("maps the D-pad to next/previous", () => {
    expect(gamepadIntentFor(GAMEPAD_BUTTON.dpadRight)).toBe("next");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.dpadDown)).toBe("next");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.dpadLeft)).toBe("previous");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.dpadUp)).toBe("previous");
  });

  test("maps A to activate, Y to inspect, B to cancel", () => {
    expect(gamepadIntentFor(GAMEPAD_BUTTON.a)).toBe("activate");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.y)).toBe("inspect");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.b)).toBe("cancel");
  });

  test("a button no standard layout defines maps to nothing", () => {
    expect(gamepadIntentFor(99)).toBeNull();
  });

  test("maps the shoulder buttons to paging", () => {
    expect(gamepadIntentFor(GAMEPAD_BUTTON.l1)).toBe("pagePrevious");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.r1)).toBe("pageNext");
  });

  // §3.10/§7 accessibility fix: X moves focus into/out of the guide surface, mirroring the keyboard's "G".
  test("maps X to the guide's own focus-region toggle", () => {
    expect(gamepadIntentFor(GAMEPAD_BUTTON.x)).toBe("toggleGuide");
  });

  test("every mapped button names a distinct, real intent", () => {
    const intents = Object.values(GAMEPAD_BUTTON)
      .map((index) => gamepadIntentFor(index))
      .filter((intent): intent is GamepadIntent => intent !== null);
    // Every one of the ten named buttons now means something.
    expect(intents).toHaveLength(10);
    expect(new Set(intents)).toEqual(
      new Set<GamepadIntent>([
        "next",
        "previous",
        "activate",
        "inspect",
        "cancel",
        "pagePrevious",
        "pageNext",
        "toggleGuide",
      ]),
    );
  });
});
