// @vitest-environment happy-dom
import { describe, expect, test, vi } from "vitest";
import type Phaser from "phaser";
import { PopupSheet } from "./popup-sheet.js";

vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("./dom-region.js", () => ({
  DomRegion: class {
    readonly element: HTMLElement;
    constructor(_scene: unknown, element: HTMLElement) {
      this.element = Object.assign(element, { elementOf: () => null });
    }
    follow = vi.fn();
    setRect = vi.fn();
    setHoles = vi.fn();
  },
  renderNow: () => undefined,
}));
vi.mock("./sheet-builder.js", () => ({ SheetBuilder: class {}, sheetColor: () => "" }));
vi.mock("../session.js", () => ({
  appSession: () => ({ settings: { reducedMotion: false, keyboardHand: "left" } }),
}));

function fakeScene() {
  const add = vi.fn();
  const scene = {
    sys: { settings: { key: "AnchoredPopup" }, isActive: () => true },
    input: { enabled: true, keyboard: { enabled: true, on: () => undefined } },
    scene: { key: "AnchoredPopup", stop: vi.fn(), manager: { isActive: () => false } },
    events: { on: () => undefined, once: () => undefined, off: () => undefined },
    tweens: { add, killTweensOf: vi.fn() },
  };
  return { scene: scene as unknown as Phaser.Scene, add, killTweensOf: scene.tweens.killTweensOf };
}

const builder = { nodes: [{ kind: "box", rect: { x: 0, y: 0, width: 100, height: 100 } }] } as never;
const anchor = { x: 0, y: 0, alpha: 1, active: true };

describe("PopupSheet with an anchor of its own", () => {
  test("followed before the first mount, it never starts the built-in slide or marks the panel as a pop-up", () => {
    const fake = fakeScene();
    const panel = new PopupSheet(fake.scene, () => undefined);
    panel.follow(anchor);
    panel.mount(builder, 100, 100);
    expect(fake.add).not.toHaveBeenCalled();
    expect(panel.element?.hasAttribute("popup")).toBe(false);
  });

  test("followed after a mount, it stops the built-in entrance and gives the box to the anchor", () => {
    const fake = fakeScene();
    const panel = new PopupSheet(fake.scene, () => undefined);
    panel.mount(builder, 100, 100);
    expect(fake.add).toHaveBeenCalledTimes(1);
    expect(panel.element?.hasAttribute("popup")).toBe(true);
    panel.follow(anchor);
    expect(fake.killTweensOf).toHaveBeenCalled();
    expect(panel.element?.hasAttribute("popup")).toBe(false);
    expect(panel.element?.style.getPropertyValue("--mc-popup-slide")).toBe("0px");
  });
});
