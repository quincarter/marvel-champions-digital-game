import { describe, expect, test } from "vitest";
import { INITIAL_LIVE_STATE } from "../live/watch-events.js";
import { livePillKey, livePillOf } from "./live-pill.js";

describe("livePillOf", () => {
  test("says LIVE with a dot while the host is there, HOST AWAY with a hollow one while not", () => {
    expect(livePillOf({ ...INITIAL_LIVE_STATE, hostConnected: true })).toEqual({
      tone: "live",
      glyph: "\u25cf",
      word: "LIVE",
    });
    expect(livePillOf(INITIAL_LIVE_STATE)).toEqual({ tone: "away", glyph: "\u25cb", word: "HOST AWAY" });
  });

  test("says FEED LOST once following failed, and is gone when the game ends or it is an ordinary replay", () => {
    expect(livePillOf({ ...INITIAL_LIVE_STATE, over: true, failed: true })).toEqual({
      tone: "failed",
      glyph: null,
      word: "FEED LOST",
    });
    expect(livePillOf({ ...INITIAL_LIVE_STATE, over: true })).toBeNull();
    expect(livePillOf(null)).toBeNull();
  });

  test("a redraw is keyed on the words, not on who is watching", () => {
    const a = livePillOf({ ...INITIAL_LIVE_STATE, hostConnected: true, watchers: 1 });
    const b = livePillOf({ ...INITIAL_LIVE_STATE, hostConnected: true, watchers: 5 });
    expect(livePillKey(a)).toBe(livePillKey(b));
    expect(livePillKey(a)).not.toBe(livePillKey(livePillOf(INITIAL_LIVE_STATE)));
    expect(livePillKey(null)).toBe("");
  });
});
