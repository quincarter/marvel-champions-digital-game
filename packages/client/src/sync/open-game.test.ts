import { describe, expect, test } from "vitest";
import { OpenGameTracker, RESUME_GRACE_MS } from "./open-game.js";

describe("OpenGameTracker", () => {
  test("the game on the table is the open one, and none off the table", () => {
    const t = new OpenGameTracker(() => 0);
    expect(t.current(true, "g1")).toBe("g1");
    expect(t.current(false, "g1")).toBeNull();
  });

  test("a game being resumed is held before the table is up, through play, and released after leaving", () => {
    let now = 0;
    const t = new OpenGameTracker(() => now);
    t.begin("g2");
    expect(t.current(false, "old")).toBe("g2");
    now += 1000;
    expect(t.current(true, "g2")).toBe("g2");
    expect(t.current(false, "g2")).toBeNull();
  });

  test("a resume that never reaches the table is released after the grace", () => {
    let now = 0;
    const t = new OpenGameTracker(() => now);
    t.begin("g2");
    now += RESUME_GRACE_MS - 1;
    expect(t.current(false, null)).toBe("g2");
    now += 2;
    expect(t.current(false, null)).toBeNull();
  });
});
