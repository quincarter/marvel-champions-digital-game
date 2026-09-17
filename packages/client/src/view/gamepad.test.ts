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

  test("a button this board doesn't use maps to nothing", () => {
    expect(gamepadIntentFor(GAMEPAD_BUTTON.x)).toBeNull();
    expect(gamepadIntentFor(99)).toBeNull();
  });

  test("maps the shoulder buttons to paging", () => {
    expect(gamepadIntentFor(GAMEPAD_BUTTON.l1)).toBe("pagePrevious");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.r1)).toBe("pageNext");
  });

  test("every mapped button names a distinct, real intent", () => {
    const intents = Object.values(GAMEPAD_BUTTON)
      .map((index) => gamepadIntentFor(index))
      .filter((intent): intent is GamepadIntent => intent !== null);
    // x is deliberately unmapped, so one of the ten named buttons contributes nothing here.
    expect(intents).toHaveLength(9);
    expect(new Set(intents)).toEqual(
      new Set<GamepadIntent>(["next", "previous", "activate", "inspect", "cancel", "pagePrevious", "pageNext"]),
    );
  });
});
