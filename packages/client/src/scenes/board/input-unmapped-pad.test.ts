import { afterEach, describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { gamepadIntentFor } from "../../view/gamepad.js";
import { bindGamepad, type IntentBinding } from "./input.js";

vi.mock("../../session.js", () => ({
  appSession: () => ({ settings: { padGlyphFamily: "auto", nintendoLayout: false } }),
}));

const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 13; Retroid Pocket 4 Pro Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface FakeButton {
  index: number;
  pressed: boolean;
  value: number;
}

/**
 * A pad as Phaser's gamepad plugin wraps it, reporting the layout Android's Chromium gives a controller it has no table
 * for (a Retroid Pocket's built-in controls): the standard button order, with `mapping: ""`.
 */
function unmappedPad(axes: number[] = [0, 0, 0, 0]) {
  const buttons: FakeButton[] = Array.from({ length: 16 }, (_, index) => ({ index, pressed: false, value: 0 }));
  return {
    id: "Retroid Pocket Controller",
    index: 0,
    connected: true,
    pad: { mapping: "" },
    buttons,
    axes: axes.map((value) => ({ getValue: () => value })),
  };
}

/** A scene with the gamepad plugin's down / up events and the per-frame update the binding polls on. */
function harness(pad: ReturnType<typeof unmappedPad>) {
  const handlers: Record<string, Array<(pad: unknown, button: FakeButton) => void>> = { down: [], up: [] };
  const frame: Array<(time: number, delta: number) => void> = [];
  const scene = {
    time: { now: 0 },
    events: {
      on: (name: string, fn: (time: number, delta: number) => void) => name === "update" && frame.push(fn),
      once: () => undefined,
      off: () => undefined,
    },
    game: { loop: { frame: 0 }, events: { on: () => undefined, off: () => undefined } },
    input: {
      enabled: true,
      keyboard: { enabled: true },
      gamepad: {
        gamepads: [pad],
        on: (name: string, fn: (pad: unknown, button: FakeButton) => void) => handlers[name]?.push(fn),
      },
    },
    scene: { key: "board", manager: { isActive: () => false, getScene: () => null } },
  } as unknown as Phaser.Scene;
  let now = 0;
  return {
    scene,
    press(index: number) {
      const button = pad.buttons[index]!;
      button.pressed = true;
      button.value = 1;
      handlers.down!.forEach((fn) => fn(pad, button));
    },
    step() {
      now += 16;
      (scene as unknown as { time: { now: number }; game: { loop: { frame: number } } }).game.loop.frame += 1;
      frame.forEach((fn) => fn(now, 16));
    },
  };
}

function bind(pad: ReturnType<typeof unmappedPad>, userAgent: string) {
  vi.stubGlobal("navigator", { userAgent, getGamepads: () => [] });
  const h = harness(pad);
  const onIntent = vi.fn();
  const onScroll = vi.fn();
  const binding: IntentBinding = { blocked: () => false, onIntent, onScroll };
  bindGamepad(h.scene, binding);
  h.step();
  return { ...h, onIntent, onScroll };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a controller Android's Chromium has no table for", () => {
  test("its face buttons and D-pad drive the game on Android", () => {
    const pad = unmappedPad();
    const h = bind(pad, ANDROID_WEBVIEW);
    h.press(0);
    expect(h.onIntent).toHaveBeenCalledWith(gamepadIntentFor(0));
    h.onIntent.mockClear();
    pad.buttons[13]!.pressed = true;
    h.step();
    expect(h.onIntent).toHaveBeenCalledWith("down");
  });

  test("its left stick walks the focus", () => {
    const pad = unmappedPad();
    const h = bind(pad, ANDROID_WEBVIEW);
    pad.axes[1] = { getValue: () => 1 };
    h.step();
    expect(h.onIntent).toHaveBeenCalledWith("down");
  });

  // Chromium may fill the right-stick slots of a pad without one with another axis (a throttle, a lone trigger).
  test("whatever sits in its right-stick slots never scrolls: resting pushed, crossing zero, or after a reconnect", () => {
    const pad = unmappedPad();
    const h = bind(pad, ANDROID_WEBVIEW);
    for (const value of [-1, -1, 0, 0.5, 1, 0, -1]) {
      pad.axes[2] = { getValue: () => value };
      pad.axes[3] = { getValue: () => value };
      h.step();
    }
    pad.connected = false;
    h.step();
    pad.connected = true;
    for (const value of [0, 1, -1]) {
      pad.axes[2] = { getValue: () => value };
      h.step();
    }
    expect(h.onScroll).not.toHaveBeenCalled();
  });

  test("a standard pad's right stick still scrolls (the harness sees a scroll when there is one)", () => {
    const pad = unmappedPad();
    pad.pad.mapping = "standard";
    const h = bind(pad, ANDROID_WEBVIEW);
    pad.axes[3] = { getValue: () => 1 };
    h.step();
    expect(h.onScroll).toHaveBeenCalled();
  });

  test("the same pad is ignored on the desktop, where its buttons would come in raw order", () => {
    const pad = unmappedPad();
    const h = bind(pad, WINDOWS_CHROME);
    h.press(0);
    pad.buttons[13]!.pressed = true;
    h.step();
    h.step();
    expect(h.onIntent).not.toHaveBeenCalled();
  });
});
