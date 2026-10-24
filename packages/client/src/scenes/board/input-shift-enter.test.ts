import { beforeEach, describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { bindKeyboard, type IntentBinding } from "./input.js";

const session = vi.hoisted(() => ({ hand: "left" as "left" | "right" }));
// The real session starts the engine worker; the keyboard only reads the hand setting live.
vi.mock("../../session.js", () => ({
  appSession: () => ({ settings: { keyboardHand: session.hand } }),
}));

/** A scene whose keyboard hands every listener the events pushed through `press`. */
function keyboardScene(): { scene: Phaser.Scene; press: (event: Partial<KeyboardEvent>) => void } {
  const listeners: Array<(event: KeyboardEvent) => void> = [];
  const scene = {
    input: { keyboard: { on: (_name: string, fn: (event: KeyboardEvent) => void) => listeners.push(fn) } },
    scene: { key: "board", manager: { isActive: () => false } },
  } as unknown as Phaser.Scene;
  return {
    scene,
    press: (event) => {
      const full = { preventDefault: () => undefined, shiftKey: false, ctrlKey: false, ...event } as KeyboardEvent;
      for (const fn of listeners) fn(full);
    },
  };
}

function bound(): { onIntent: ReturnType<typeof vi.fn>; press: (event: Partial<KeyboardEvent>) => void } {
  const { scene, press } = keyboardScene();
  const onIntent = vi.fn();
  const binding: IntentBinding = { blocked: () => false, onIntent };
  bindKeyboard(scene, binding);
  return { onIntent, press };
}

beforeEach(() => {
  session.hand = "left";
});

describe("Shift+Enter on any screen bound through bindKeyboard", () => {
  test("sends no activate, while plain Enter does", () => {
    const { onIntent, press } = bound();
    press({ code: "Enter", key: "Enter", shiftKey: true });
    press({ code: "Space", key: " ", shiftKey: true });
    expect(onIntent).not.toHaveBeenCalled();
    press({ code: "Enter", key: "Enter" });
    expect(onIntent).toHaveBeenCalledWith("activate");
  });
});

describe("bindKeyboard's map", () => {
  test("follows the keyboard hand setting live, by physical key", () => {
    const { onIntent, press } = bound();
    // AZERTY: the key at the QWERTY W position types "z".
    press({ code: "KeyW", key: "z" });
    expect(onIntent).toHaveBeenLastCalledWith("up");
    press({ code: "KeyI", key: "i" });
    expect(onIntent).toHaveBeenCalledTimes(1);
    session.hand = "right";
    press({ code: "KeyI", key: "i" });
    expect(onIntent).toHaveBeenLastCalledWith("up");
    press({ code: "KeyW", key: "w" });
    expect(onIntent).toHaveBeenCalledTimes(2);
  });

  test("ignores a key typed into a text field", () => {
    const { onIntent, press } = bound();
    press({ code: "KeyE", key: "e", target: { tagName: "INPUT" } as unknown as EventTarget });
    press({ code: "Space", key: " ", target: { tagName: "INPUT" } as unknown as EventTarget });
    expect(onIntent).not.toHaveBeenCalled();
    press({ code: "KeyE", key: "e" });
    expect(onIntent).toHaveBeenCalledWith("inspect");
  });
});
