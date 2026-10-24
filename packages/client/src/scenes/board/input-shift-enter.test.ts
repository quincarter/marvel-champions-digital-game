import { describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { bindKeyboard, type IntentBinding } from "./input.js";

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
      const full = { preventDefault: () => undefined, shiftKey: false, ...event } as KeyboardEvent;
      for (const fn of listeners) fn(full);
    },
  };
}

describe("Shift+Enter on any screen bound through bindKeyboard", () => {
  test("sends no activate, while plain Enter does", () => {
    const { scene, press } = keyboardScene();
    const onIntent = vi.fn();
    const binding: IntentBinding = { blocked: () => false, onIntent };
    bindKeyboard(scene, binding);
    press({ key: "Enter", shiftKey: true });
    expect(onIntent).not.toHaveBeenCalled();
    press({ key: "Enter" });
    expect(onIntent).toHaveBeenCalledWith("activate");
  });
});
