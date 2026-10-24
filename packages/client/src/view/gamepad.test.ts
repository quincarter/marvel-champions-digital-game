/**
 * Gamepad → intent mapping. The risk here is a button silently meaning
 * nothing, or two buttons racing to mean two different things.
 */

import { describe, expect, test } from "vitest";
import { GAMEPAD_BUTTON, directionOf, gamepadIntentFor, linearIntent, type GamepadIntent } from "./gamepad.js";

describe("gamepadIntentFor", () => {
  // Issue #206: the D-pad moves the way it points, like the arrow keys, instead of walking the route like Tab.
  test("maps the D-pad to its four directions", () => {
    expect(gamepadIntentFor(GAMEPAD_BUTTON.dpadRight)).toBe("right");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.dpadDown)).toBe("down");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.dpadLeft)).toBe("left");
    expect(gamepadIntentFor(GAMEPAD_BUTTON.dpadUp)).toBe("up");
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
    // Every named button but L3 and the home button means something.
    expect(intents).toHaveLength(15);
    expect(new Set(intents)).toEqual(
      new Set<GamepadIntent>([
        "up",
        "down",
        "left",
        "right",
        "activate",
        "inspect",
        "cancel",
        "pagePrevious",
        "pageNext",
        "toggleGuide",
        "undo",
        "endTurn",
        "pause",
        "view",
        "expand",
      ]),
    );
  });

  test("directionOf names only the four direction intents", () => {
    expect(directionOf("up")).toBe("up");
    expect(directionOf("right")).toBe("right");
    expect(directionOf("next")).toBeNull();
    expect(directionOf("activate")).toBeNull();
  });

  test("linearIntent folds a direction back onto the route for a surface with no layout to move through", () => {
    expect(linearIntent("right")).toBe("next");
    expect(linearIntent("down")).toBe("next");
    expect(linearIntent("left")).toBe("previous");
    expect(linearIntent("up")).toBe("previous");
    expect(linearIntent("activate")).toBe("activate");
  });
});
