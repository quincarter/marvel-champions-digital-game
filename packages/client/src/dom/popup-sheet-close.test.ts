// @vitest-environment happy-dom
import { describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { bindKeyboard } from "../scenes/board/input.js";
import { PopupSheet } from "./popup-sheet.js";

// The real session starts the engine worker; the pop-up only reads the reduced-motion setting, the keyboard the hand.
vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("./dom-region.js", () => ({ DomRegion: class {}, renderNow: () => undefined }));
vi.mock("./sheet-builder.js", () => ({ SheetBuilder: class {}, sheetColor: () => "" }));
vi.mock("../session.js", () => ({
  appSession: () => ({ settings: { reducedMotion: false, keyboardHand: "left" } }),
}));

function fakeScene() {
  const listeners = new Map<string, Array<() => void>>();
  const keys: Array<(event: KeyboardEvent) => void> = [];
  const stop = vi.fn();
  const scene = {
    sys: { settings: { key: "FakePopup" }, isActive: () => true },
    input: {
      enabled: true,
      keyboard: { enabled: true, on: (_name: string, fn: (event: KeyboardEvent) => void) => keys.push(fn) },
    },
    scene: { key: "FakePopup", stop, manager: { isActive: () => false } },
    events: {
      on: (name: string, fn: () => void) => void (listeners.get(name) ?? listeners.set(name, []).get(name)!).push(fn),
      once: (name: string, fn: () => void) => void (listeners.get(name) ?? listeners.set(name, []).get(name)!).push(fn),
      off: () => undefined,
    },
  };
  return {
    scene: scene as unknown as Phaser.Scene,
    stop,
    emit: (name: string) => listeners.get(name)?.forEach((fn) => fn()),
    press: (code: string) =>
      keys.forEach((fn) => fn({ code, key: code, preventDefault: () => undefined, shiftKey: false } as KeyboardEvent)),
  };
}

describe("PopupSheet.close", () => {
  test("turns input and keyboard off, stops the scene once and runs the answer once", () => {
    const fake = fakeScene();
    const panel = new PopupSheet(fake.scene, () => undefined);
    const after = vi.fn();
    expect(panel.leaving).toBe(false);
    panel.close(after);
    panel.close(after);
    expect(panel.leaving).toBe(true);
    expect(fake.scene.input.enabled).toBe(false);
    expect(fake.scene.input.keyboard!.enabled).toBe(false);
    expect(PopupSheet.isLeaving("FakePopup")).toBe(true);
    expect(fake.stop).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    // The stop's own shutdown neither repeats the answer nor leaves the scene marked leaving.
    fake.emit("shutdown");
    expect(after).toHaveBeenCalledTimes(1);
    expect(PopupSheet.isLeaving("FakePopup")).toBe(false);
    expect(fake.scene.input.enabled).toBe(true);
  });

  test("an exit that was never started cannot be taken back", () => {
    const panel = new PopupSheet(fakeScene().scene, () => undefined);
    expect(panel.cancelExit()).toBeNull();
  });
});

describe("a pop-up's focus route while it is leaving", () => {
  test("takes Enter before the exit and not after", () => {
    const fake = fakeScene();
    const panel = new PopupSheet(fake.scene, () => undefined);
    const onIntent = vi.fn();
    bindKeyboard(fake.scene, { blocked: () => panel.leaving, onIntent });
    fake.press("Enter");
    expect(onIntent).toHaveBeenCalledWith("activate", "key");
    onIntent.mockClear();
    panel.close();
    fake.press("Escape");
    fake.press("Enter");
    expect(onIntent).not.toHaveBeenCalled();
  });
});
