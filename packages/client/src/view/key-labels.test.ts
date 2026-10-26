import { afterEach, describe, expect, it } from "vitest";
import { shortcutCaps } from "./input-shortcuts.js";
import { keyLabelOfCode, setKeyLayoutForTest } from "./key-labels.js";

describe("key labels by layout", () => {
  afterEach(() => setKeyLayoutForTest(null));

  it("falls back to the QWERTY caps with no layout map", () => {
    setKeyLayoutForTest(null);
    expect(shortcutCaps("moveUp", "left")).toEqual(["W"]);
    expect(keyLabelOfCode("KeyW")).toBeNull();
  });

  it("an AZERTY map relabels the movement keys Z Q S D", () => {
    setKeyLayoutForTest(
      new Map([
        ["KeyW", "z"],
        ["KeyA", "q"],
        ["KeyS", "s"],
        ["KeyD", "d"],
        ["KeyZ", "w"],
      ]),
    );
    expect(["moveUp", "moveLeft", "moveDown", "moveRight"].map((id) => shortcutCaps(id as "moveUp", "left"))).toEqual([
      ["Z"],
      ["Q"],
      ["S"],
      ["D"],
    ]);
    // Undo is matched by the printed Z, so its cap stays Z whatever the layout.
    expect(shortcutCaps("undo", "left")).toEqual(["Ctrl", "Z"]);
  });

  it("leaves non-letter keys and unprintable entries alone", () => {
    setKeyLayoutForTest(new Map([["Space", " "]]));
    expect(shortcutCaps("activate", "left")).toEqual(["Space"]);
  });
});
