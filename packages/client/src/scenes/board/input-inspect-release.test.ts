import { describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { bindKeyboard, type IntentBinding } from "./input.js";

vi.mock("../../session.js", () => ({
  appSession: () => ({ settings: { keyboardHand: "left" } }),
}));

/** A scene with a clock and separate keydown / keyup listeners, as Phaser's keyboard plugin has. */
function harness() {
  const down: Array<(e: KeyboardEvent) => void> = [];
  const up: Array<(e: KeyboardEvent) => void> = [];
  const frame: Array<() => void> = [];
  const blur: Array<() => void> = [];
  const scene = {
    time: { now: 0 },
    events: {
      on: (name: string, fn: () => void) => name === "update" && frame.push(fn),
      once: () => undefined,
      off: () => undefined,
    },
    game: { events: { on: (name: string, fn: () => void) => name === "blur" && blur.push(fn), off: () => undefined } },
    input: {
      enabled: true,
      keyboard: {
        enabled: true,
        on: (name: string, fn: (e: KeyboardEvent) => void) => (name === "keyup" ? up : down).push(fn),
      },
    },
    scene: { key: "board", manager: { isActive: () => false } },
  } as unknown as Phaser.Scene;
  const event = (e: Partial<KeyboardEvent>): KeyboardEvent =>
    ({ preventDefault: () => undefined, shiftKey: false, ctrlKey: false, ...e }) as KeyboardEvent;
  return {
    scene,
    keydown: (e: Partial<KeyboardEvent>) => down.forEach((fn) => fn(event(e))),
    keyup: (e: Partial<KeyboardEvent>) => up.forEach((fn) => fn(event(e))),
    advance: (ms: number) => {
      (scene as unknown as { time: { now: number } }).time.now += ms;
      frame.forEach((fn) => fn());
    },
    blur: () => blur.forEach((fn) => fn()),
  };
}

describe("releasing the Inspect hold", () => {
  test("closes the zoom on the holder's keyup even though Shift went down meanwhile", () => {
    const h = harness();
    const onInspectZoom = vi.fn();
    const onIntent = vi.fn();
    const binding: IntentBinding = { blocked: () => false, onIntent, onInspectZoom };
    bindKeyboard(h.scene, binding);

    h.keydown({ code: "KeyE", key: "e" });
    h.advance(400);
    expect(onInspectZoom).toHaveBeenLastCalledWith(true);
    h.keydown({ code: "ShiftLeft", key: "Shift", shiftKey: true });
    h.keyup({ code: "KeyE", key: "E", shiftKey: true });
    expect(onInspectZoom).toHaveBeenLastCalledWith(false);
    expect(onIntent).not.toHaveBeenCalled();
    h.keyup({ code: "ShiftLeft", key: "Shift" });

    // A later Inspect works: a tap opens Inspect, a hold zooms again.
    h.keydown({ code: "KeyE", key: "e" });
    h.keyup({ code: "KeyE", key: "e" });
    expect(onIntent).toHaveBeenCalledWith("inspect");
    h.keydown({ code: "KeyE", key: "e" });
    h.advance(400);
    expect(onInspectZoom).toHaveBeenLastCalledWith(true);
  });

  test("drops the hold when the window loses focus mid-hold, so the zoom closes and the next press works", () => {
    const h = harness();
    const onInspectZoom = vi.fn();
    const onIntent = vi.fn();
    bindKeyboard(h.scene, { blocked: () => false, onIntent, onInspectZoom });

    h.keydown({ code: "KeyE", key: "e" });
    h.advance(400);
    expect(onInspectZoom).toHaveBeenLastCalledWith(true);
    // Alt+Tab: the keyup goes to another window and never arrives here.
    h.blur();
    expect(onInspectZoom).toHaveBeenLastCalledWith(false);

    // Back in the window, the next tap inspects at once.
    h.keydown({ code: "KeyE", key: "e" });
    h.keyup({ code: "KeyE", key: "e" });
    expect(onIntent).toHaveBeenCalledWith("inspect");
  });
});
