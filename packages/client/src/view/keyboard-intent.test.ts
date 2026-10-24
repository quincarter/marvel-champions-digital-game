import { describe, expect, it } from "vitest";
import {
  boardKeyActionOf,
  choiceSlotOf,
  isTextEntry,
  navIntentOf,
  peekExpandOf,
  type KeyEventLike,
} from "./keyboard-intent.js";

function key(code: string, mods: Partial<KeyEventLike> = {}): KeyEventLike {
  return { code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...mods };
}

describe("navIntentOf", () => {
  it("a held key repeats only the moves: Select, Back, Inspect and the guide fire once", () => {
    const held = { repeat: true };
    expect(navIntentOf(key("KeyW", held), "left")).toBe("up");
    expect(navIntentOf(key("Tab", held), "left")).toBe("next");
    expect(navIntentOf(key("Space", held), "left")).toBeNull();
    expect(navIntentOf(key("Enter", held), "left")).toBeNull();
    expect(navIntentOf(key("Escape", held), "left")).toBeNull();
    expect(navIntentOf(key("KeyE", held), "left")).toBeNull();
    expect(navIntentOf(key("KeyG", held), "left")).toBeNull();
    expect(navIntentOf(key("Space"), "left")).toBe("activate");
  });

  it("Ctrl+Z is Undo by the printed Z as well as the physical key (AZERTY)", () => {
    expect(boardKeyActionOf(key("KeyZ", { ctrlKey: true, key: "z" }), "left")).toEqual({ kind: "undo" });
    // AZERTY: the printed Z is on the physical W key.
    expect(boardKeyActionOf(key("KeyW", { ctrlKey: true, key: "z" }), "left")).toEqual({ kind: "undo" });
    expect(boardKeyActionOf(key("KeyW", { ctrlKey: true, key: "w" }), "left")).toBeNull();
    expect(boardKeyActionOf(key("KeyW", { key: "z" }), "left")).toBeNull();
  });

  it("moves with WASD and the arrows left-handed, IJKL and the arrows right-handed", () => {
    expect(["KeyW", "KeyS", "KeyA", "KeyD"].map((c) => navIntentOf(key(c), "left"))).toEqual([
      "up",
      "down",
      "left",
      "right",
    ]);
    expect(["KeyI", "KeyK", "KeyJ", "KeyL"].map((c) => navIntentOf(key(c), "right"))).toEqual([
      "up",
      "down",
      "left",
      "right",
    ]);
    expect(navIntentOf(key("ArrowUp"), "left")).toBe("up");
    expect(navIntentOf(key("ArrowLeft"), "right")).toBe("left");
  });

  it("leaves the other hand's letters alone", () => {
    expect(navIntentOf(key("KeyI"), "left")).toBeNull();
    expect(navIntentOf(key("KeyW"), "right")).toBeNull();
    expect(navIntentOf(key("KeyG"), "right")).toBeNull();
  });

  it("selects, backs, inspects and toggles the guide by hand", () => {
    expect(navIntentOf(key("Space"), "left")).toBe("activate");
    expect(navIntentOf(key("Enter"), "left")).toBe("activate");
    expect(navIntentOf(key("Enter"), "right")).toBe("activate");
    expect(navIntentOf(key("Space"), "right")).toBeNull();
    expect(navIntentOf(key("KeyQ"), "left")).toBe("cancel");
    expect(navIntentOf(key("KeyU"), "right")).toBe("cancel");
    expect(navIntentOf(key("Escape"), "left")).toBe("cancel");
    expect(navIntentOf(key("Escape"), "right")).toBe("cancel");
    expect(navIntentOf(key("KeyE"), "left")).toBe("inspect");
    expect(navIntentOf(key("KeyO"), "right")).toBe("inspect");
    expect(navIntentOf(key("KeyG"), "left")).toBe("toggleGuide");
    expect(navIntentOf(key("KeyH"), "right")).toBe("toggleGuide");
  });

  it("never activates on Shift+Enter or Shift+Space (End turn)", () => {
    for (const hand of ["left", "right"] as const) {
      expect(navIntentOf(key("Enter", { shiftKey: true }), hand)).toBeNull();
      expect(navIntentOf(key("Space", { shiftKey: true }), hand)).toBeNull();
    }
  });

  it("does not take Shift+E (Evidence) for Inspect, or Ctrl, Cmd and Alt chords for letters", () => {
    expect(navIntentOf(key("KeyE", { shiftKey: true }), "left")).toBeNull();
    expect(navIntentOf(key("KeyW", { ctrlKey: true }), "left")).toBeNull();
    expect(navIntentOf(key("KeyA", { metaKey: true }), "left")).toBeNull();
    expect(navIntentOf(key("KeyD", { altKey: true }), "left")).toBeNull();
  });

  it("keeps Tab, Shift+Tab and the page keys fixed", () => {
    expect(navIntentOf(key("Tab"), "left")).toBe("next");
    expect(navIntentOf(key("Tab", { shiftKey: true }), "right")).toBe("previous");
    expect(navIntentOf(key("Tab", { ctrlKey: true }), "left")).toBeNull();
    expect(navIntentOf(key("PageDown"), "right")).toBe("pageNext");
    expect(navIntentOf(key("PageUp"), "left")).toBe("pagePrevious");
    expect(navIntentOf(key("Home"), "left")).toBe("home");
    expect(navIntentOf(key("End"), "left")).toBe("end");
  });

  it("matches the physical key, so an AZERTY layout keeps WASD under the left hand", () => {
    // On AZERTY the key at the QWERTY W position types "z" and the one at Q types "a": only `code` is read.
    const azertyUp = { ...key("KeyW"), key: "z" } as KeyEventLike;
    const azertyBack = { ...key("KeyQ"), key: "a" } as KeyEventLike;
    expect(navIntentOf(azertyUp, "left")).toBe("up");
    expect(navIntentOf(azertyBack, "left")).toBe("cancel");
    expect(navIntentOf({ ...key("KeyA"), key: "q" } as KeyEventLike, "left")).toBe("left");
  });
});

describe("boardKeyActionOf", () => {
  it("maps the basic actions by hand", () => {
    expect(["KeyZ", "KeyX", "KeyC", "KeyV"].map((c) => boardKeyActionOf(key(c), "left"))).toEqual([
      { kind: "basic", action: "attack" },
      { kind: "basic", action: "thwart" },
      { kind: "basic", action: "recover" },
      { kind: "basic", action: "changeForm" },
    ]);
    expect(["KeyM", "Comma", "Period", "Slash"].map((c) => boardKeyActionOf(key(c), "right"))).toEqual([
      { kind: "basic", action: "attack" },
      { kind: "basic", action: "thwart" },
      { kind: "basic", action: "recover" },
      { kind: "basic", action: "changeForm" },
    ]);
    expect(boardKeyActionOf(key("KeyM"), "left")).toBeNull();
  });

  it("ends the turn on Shift+Space / Shift+Enter, and only Shift+Enter right-handed", () => {
    expect(boardKeyActionOf(key("Space", { shiftKey: true }), "left")).toEqual({ kind: "endTurn" });
    expect(boardKeyActionOf(key("Enter", { shiftKey: true }), "left")).toEqual({ kind: "endTurn" });
    expect(boardKeyActionOf(key("Enter", { shiftKey: true }), "right")).toEqual({ kind: "endTurn" });
    expect(boardKeyActionOf(key("Space", { shiftKey: true }), "right")).toBeNull();
    expect(boardKeyActionOf(key("Enter"), "left")).toBeNull();
  });

  it("undoes on Ctrl+Z (or Cmd+Z) and bare Z is Attack, not Undo", () => {
    expect(boardKeyActionOf(key("KeyZ", { ctrlKey: true }), "left")).toEqual({ kind: "undo" });
    expect(boardKeyActionOf(key("KeyZ", { metaKey: true }), "right")).toEqual({ kind: "undo" });
    expect(boardKeyActionOf(key("KeyZ"), "left")).toEqual({ kind: "basic", action: "attack" });
    expect(boardKeyActionOf(key("KeyZ"), "right")).toBeNull();
  });

  it("jumps zones with R/F or P/; and the brackets", () => {
    expect(boardKeyActionOf(key("KeyR"), "left")).toEqual({ kind: "zone", step: -1 });
    expect(boardKeyActionOf(key("KeyF"), "left")).toEqual({ kind: "zone", step: 1 });
    expect(boardKeyActionOf(key("KeyP"), "right")).toEqual({ kind: "zone", step: -1 });
    expect(boardKeyActionOf(key("Semicolon"), "right")).toEqual({ kind: "zone", step: 1 });
    for (const hand of ["left", "right"] as const) {
      expect(boardKeyActionOf(key("BracketLeft"), hand)).toEqual({ kind: "zone", step: -1 });
      expect(boardKeyActionOf(key("BracketRight"), hand)).toEqual({ kind: "zone", step: 1 });
    }
    // Ctrl+R is the browser's reload.
    expect(boardKeyActionOf(key("KeyR", { ctrlKey: true }), "left")).toBeNull();
  });

  it("opens the log, Team-Up and Evidence by hand", () => {
    // B / N reopen the villain phase recap; Shift+B / Shift+N are the log.
    expect(boardKeyActionOf(key("KeyB"), "left")).toEqual({ kind: "recap" });
    expect(boardKeyActionOf(key("KeyN"), "right")).toEqual({ kind: "recap" });
    expect(boardKeyActionOf(key("KeyB", { shiftKey: true }), "left")).toEqual({ kind: "log" });
    expect(boardKeyActionOf(key("KeyN", { shiftKey: true }), "right")).toEqual({ kind: "log" });
    expect(boardKeyActionOf(key("KeyT"), "left")).toEqual({ kind: "teamUp" });
    expect(boardKeyActionOf(key("KeyY"), "right")).toEqual({ kind: "teamUp" });
    expect(boardKeyActionOf(key("KeyE", { shiftKey: true }), "left")).toEqual({ kind: "evidence" });
    expect(boardKeyActionOf(key("KeyO", { shiftKey: true }), "right")).toEqual({ kind: "evidence" });
    expect(boardKeyActionOf(key("KeyE"), "left")).toBeNull();
  });

  it("numbers the abilities 1-4 left-handed and 7-0 right-handed", () => {
    expect(["Digit1", "Digit2", "Digit3", "Digit4"].map((c) => boardKeyActionOf(key(c), "left"))).toEqual([
      { kind: "ability", slot: 0 },
      { kind: "ability", slot: 1 },
      { kind: "ability", slot: 2 },
      { kind: "ability", slot: 3 },
    ]);
    expect(["Digit7", "Digit8", "Digit9", "Digit0"].map((c) => boardKeyActionOf(key(c), "right"))).toEqual([
      { kind: "ability", slot: 0 },
      { kind: "ability", slot: 1 },
      { kind: "ability", slot: 2 },
      { kind: "ability", slot: 3 },
    ]);
    expect(boardKeyActionOf(key("Digit1"), "right")).toBeNull();
  });

  it("ignores a held key's repeats except the zone jumps", () => {
    expect(boardKeyActionOf(key("Enter", { shiftKey: true, repeat: true }), "left")).toBeNull();
    expect(boardKeyActionOf(key("KeyZ", { repeat: true }), "left")).toBeNull();
    expect(boardKeyActionOf(key("KeyZ", { ctrlKey: true, repeat: true }), "left")).toBeNull();
    expect(boardKeyActionOf(key("Digit1", { repeat: true }), "left")).toBeNull();
    expect(boardKeyActionOf(key("KeyF", { repeat: true }), "left")).toEqual({ kind: "zone", step: 1 });
  });

  it("reads the physical key on AZERTY", () => {
    expect(boardKeyActionOf({ ...key("KeyZ"), key: "w" } as KeyEventLike, "left")).toEqual({
      kind: "basic",
      action: "attack",
    });
    // AZERTY's top row types symbols for digits unshifted; the code is still Digit1.
    expect(boardKeyActionOf({ ...key("Digit1"), key: "&" } as KeyEventLike, "left")).toEqual({
      kind: "ability",
      slot: 0,
    });
  });
});

describe("choiceSlotOf", () => {
  it("answers a choice bar with 1-3, and under the right hand 7-9 too", () => {
    expect(["Digit1", "Digit2", "Digit3"].map((c) => choiceSlotOf(key(c), "left"))).toEqual([0, 1, 2]);
    expect(["Digit1", "Digit2", "Digit3"].map((c) => choiceSlotOf(key(c), "right"))).toEqual([0, 1, 2]);
    expect(["Digit7", "Digit8", "Digit9"].map((c) => choiceSlotOf(key(c), "right"))).toEqual([0, 1, 2]);
  });

  it("is not a fourth answer, a repeat or a modified digit", () => {
    expect(choiceSlotOf(key("Digit4"), "left")).toBeNull();
    expect(choiceSlotOf(key("Digit0"), "right")).toBeNull();
    expect(choiceSlotOf(key("Digit1", { repeat: true }), "left")).toBeNull();
    expect(choiceSlotOf(key("Digit1", { ctrlKey: true }), "left")).toBeNull();
  });
});

describe("peekExpandOf", () => {
  it("is R / F left-handed and P / ; right-handed", () => {
    expect(peekExpandOf(key("KeyR"), "left")).toBe("peek");
    expect(peekExpandOf(key("KeyF"), "left")).toBe("expand");
    expect(peekExpandOf(key("KeyP"), "right")).toBe("peek");
    expect(peekExpandOf(key("Semicolon"), "right")).toBe("expand");
    expect(peekExpandOf(key("KeyP"), "left")).toBeNull();
    expect(peekExpandOf(key("KeyX"), "left")).toBeNull();
  });
});

describe("isTextEntry", () => {
  it("is true for inputs, textareas and editable content, false for the canvas", () => {
    expect(isTextEntry({ tagName: "INPUT" })).toBe(true);
    expect(isTextEntry({ tagName: "textarea" })).toBe(true);
    expect(isTextEntry({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTextEntry({ tagName: "CANVAS" })).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
