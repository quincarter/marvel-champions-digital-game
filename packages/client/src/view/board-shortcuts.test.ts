import { describe, expect, it } from "vitest";
import { boardShortcutOf, type KeyPress } from "./board-shortcuts.js";

const press = (key: string, mods: Partial<KeyPress> = {}): KeyPress => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe("boardShortcutOf", () => {
  it("maps A, H, R and F to the four basic actions, in either case", () => {
    expect(boardShortcutOf(press("a"))).toEqual({ kind: "basic", action: "attack" });
    expect(boardShortcutOf(press("H"))).toEqual({ kind: "basic", action: "thwart" });
    expect(boardShortcutOf(press("r"))).toEqual({ kind: "basic", action: "recover" });
    expect(boardShortcutOf(press("F"))).toEqual({ kind: "basic", action: "changeForm" });
  });

  it("maps L to the log and the brackets to the zone jumps", () => {
    expect(boardShortcutOf(press("l"))).toEqual({ kind: "log" });
    expect(boardShortcutOf(press("["))).toEqual({ kind: "zone", step: -1 });
    expect(boardShortcutOf(press("]"))).toEqual({ kind: "zone", step: 1 });
  });

  it("claims Shift+Enter for End turn and leaves plain Enter to activate", () => {
    expect(boardShortcutOf(press("Enter", { shiftKey: true }))).toEqual({ kind: "endTurn" });
    expect(boardShortcutOf(press("Enter"))).toBeNull();
  });

  it("leaves the browser's own chords alone", () => {
    expect(boardShortcutOf(press("r", { ctrlKey: true }))).toBeNull();
    expect(boardShortcutOf(press("f", { metaKey: true }))).toBeNull();
    expect(boardShortcutOf(press("a", { altKey: true }))).toBeNull();
    expect(boardShortcutOf(press("Enter", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it("does not claim a shifted letter or keys the board uses elsewhere", () => {
    expect(boardShortcutOf(press("A", { shiftKey: true }))).toBeNull();
    for (const key of ["t", "e", "z", "i", "g", "1", "Tab", " "]) expect(boardShortcutOf(press(key))).toBeNull();
  });
});
