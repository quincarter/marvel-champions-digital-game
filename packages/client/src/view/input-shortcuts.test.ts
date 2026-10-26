import { describe, expect, it } from "vitest";
import {
  KEYBOARD_HAND_VALUES,
  SHORTCUTS,
  chordMatches,
  shortcutCaps,
  shortcutKeys,
  shortcutOf,
  shortcutsFor,
  type ShortcutId,
} from "./input-shortcuts.js";

const keydown = (code: string, mods: { shift?: boolean; ctrl?: boolean } = {}) => ({
  code,
  shiftKey: mods.shift === true,
  ctrlKey: mods.ctrl === true,
});

const BASICS: ShortcutId[] = ["attack", "thwart", "recover", "changeForm"];
const ABILITIES: ShortcutId[] = ["ability1", "ability2", "ability3", "ability4"];

describe("keyboard map", () => {
  it("draws the left hand under WASD and the right hand under IJKL", () => {
    expect(shortcutCaps("moveUp", "left")).toEqual(["W"]);
    expect(shortcutCaps("moveUp", "right")).toEqual(["I"]);
    expect(BASICS.map((id) => shortcutCaps(id, "left"))).toEqual([["Z"], ["X"], ["C"], ["V"]]);
    expect(BASICS.map((id) => shortcutCaps(id, "right"))).toEqual([["M"], [","], ["."], ["/"]]);
    expect(ABILITIES.map((id) => shortcutCaps(id, "right"))).toEqual([["7"], ["8"], ["9"], ["0"]]);
    expect(ABILITIES.map((id) => shortcutCaps(id, "left"))).toEqual([["1"], ["2"], ["3"], ["4"]]);
  });

  it("keeps arrows, Enter and Esc under both hands", () => {
    for (const hand of KEYBOARD_HAND_VALUES) {
      const codes = (id: ShortcutId): string[] => shortcutKeys(id, hand).map((chord) => chord.code);
      expect(codes("moveLeft")).toContain("ArrowLeft");
      expect(codes("select")).toContain("Enter");
      expect(codes("back")).toContain("Escape");
      expect(codes("pause")).toEqual(["Escape"]);
    }
  });

  it("puts End turn on Shift+Space (left) and Shift+Enter (right), Undo on Ctrl+Z for both", () => {
    expect(shortcutCaps("endTurn", "left")).toEqual(["Shift", "Space"]);
    expect(shortcutCaps("endTurn", "right")).toEqual(["Shift", "Enter"]);
    expect(shortcutCaps("undo", "left")).toEqual(["Ctrl", "Z"]);
    expect(shortcutCaps("undo", "right")).toEqual(["Ctrl", "Z"]);
  });

  it("gives no two actions the same chord within a hand, except the context pairs", () => {
    // Zones and Peek / Expand share keys on purpose (the popup is modal), as do the numbered choices and abilities;
    // aliases share by definition.
    const sharedOnPurpose = new Set<ShortcutId>([
      "activate",
      "select",
      "cancel",
      "back",
      "zonePrevious",
      "zoneNext",
      "zoneUp",
      "zoneDown",
      "peek",
      "expand",
      "pause",
    ]);
    for (const hand of KEYBOARD_HAND_VALUES) {
      const seen = new Map<string, ShortcutId>();
      for (const shortcut of SHORTCUTS) {
        for (const chord of shortcutKeys(shortcut.id, hand)) {
          const signature = `${chord.ctrl}|${chord.shift}|${chord.code}`;
          const other = seen.get(signature);
          if (other && other !== shortcut.id) {
            expect(
              sharedOnPurpose.has(shortcut.id) && sharedOnPurpose.has(other),
              `${hand}: ${shortcut.id} and ${other} share ${signature}`,
            ).toBe(true);
          }
          seen.set(signature, shortcut.id);
        }
      }
    }
  });

  it("matches on the physical key and exact modifiers", () => {
    const [attackLeft] = shortcutKeys("attack", "left");
    expect(chordMatches(attackLeft!, keydown("KeyZ"))).toBe(true);
    expect(chordMatches(attackLeft!, keydown("KeyZ", { ctrl: true }))).toBe(false);
    const [undo] = shortcutKeys("undo", "left");
    expect(chordMatches(undo!, keydown("KeyZ", { ctrl: true }))).toBe(true);
    expect(chordMatches(undo!, { code: "KeyZ", shiftKey: false, ctrlKey: false, metaKey: true })).toBe(true);
    expect(chordMatches(undo!, keydown("KeyZ"))).toBe(false);
    expect(shortcutsFor(keydown("Space", { shift: true }), "left")).toEqual(["endTurn"]);
    expect(shortcutsFor(keydown("KeyE", { shift: true }), "left")).toEqual(["evidence"]);
    expect(shortcutsFor(keydown("KeyE"), "left")).toEqual(["inspect"]);
    expect(shortcutsFor(keydown("KeyQ"), "right")).toEqual([]);
  });

  it("keeps the older ids reading as the same keys", () => {
    expect(shortcutCaps("zonePrevious", "left")).toEqual(shortcutCaps("zoneUp", "left"));
    expect(shortcutCaps("zoneNext", "right")).toEqual(shortcutCaps("zoneDown", "right"));
    expect(shortcutOf("activate").keys).toEqual(shortcutCaps("activate", "left"));
    expect(shortcutOf("cancel").keys).toEqual(["Q"]);
  });
});
