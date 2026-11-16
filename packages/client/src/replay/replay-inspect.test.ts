import { afterEach, describe, expect, test } from "vitest";
import {
  REPLAY_READING_KEYS,
  onReplayInspectChange,
  replayInspectChangedIn,
  replayInspectRoute,
  replayInspecting,
  resetReplayInspect,
  setReplayInspecting,
} from "./replay-inspect.js";

afterEach(() => resetReplayInspect());

describe("looking around a paused replay (#735)", () => {
  test("backing out and Start leave for the bar; Undo and End turn are dropped; moving and reading pass", () => {
    expect(replayInspectRoute("cancel")).toBe("leave");
    expect(replayInspectRoute("pause")).toBe("leave");
    expect(replayInspectRoute("undo")).toBe("drop");
    expect(replayInspectRoute("endTurn")).toBe("drop");
    for (const intent of [
      "up",
      "down",
      "left",
      "right",
      "activate",
      "inspect",
      "pageNext",
      "view",
      "expand",
    ] as const) {
      expect(replayInspectRoute(intent), intent).toBe("pass");
    }
  });

  test("only the board keys that read the table pass", () => {
    for (const kind of ["zone", "log", "recap", "discard", "deckLeft", "teamUp", "evidence"] as const) {
      expect(REPLAY_READING_KEYS.has(kind), kind).toBe(true);
    }
    for (const kind of ["basic", "endTurn", "undo", "confirm", "ability"] as const) {
      expect(REPLAY_READING_KEYS.has(kind), kind).toBe(false);
    }
  });

  test("a change is told once, and remembers the frame it was made in", () => {
    const seen: boolean[] = [];
    const off = onReplayInspectChange((on) => seen.push(on));
    setReplayInspecting(true, 10);
    setReplayInspecting(true, 11);
    expect(replayInspecting()).toBe(true);
    expect(replayInspectChangedIn(10)).toBe(true);
    expect(replayInspectChangedIn(11)).toBe(false);
    setReplayInspecting(false, 20);
    off();
    setReplayInspecting(true, 30);
    expect(seen).toEqual([true, false]);
  });

  test("a replay opening or closing starts back on the bar", () => {
    setReplayInspecting(true, 5);
    resetReplayInspect();
    expect(replayInspecting()).toBe(false);
    expect(replayInspectChangedIn(5)).toBe(false);
  });
});
