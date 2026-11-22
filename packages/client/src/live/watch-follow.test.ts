import { describe, expect, test } from "vitest";
import { followPlan, isFollowing } from "./watch-follow.js";

const base = { target: 10, oldLength: 10, newLength: 11, added: 1 } as const;

describe("followPlan", () => {
  test("a viewer at the newest position steps to a new command, so it animates", () => {
    expect(followPlan({ ...base, change: "append" })).toEqual({ kind: "step" });
  });

  test("a batch (the host was away) is jumped over, not replayed command by command", () => {
    expect(followPlan({ ...base, change: "append", newLength: 14, added: 4 })).toEqual({ kind: "seek", to: 14 });
  });

  test("a viewer who stepped back stays put on new commands", () => {
    expect(followPlan({ ...base, change: "append", target: 7 })).toEqual({ kind: "none" });
  });

  test("a rewind below the viewer moves them to the cut; above it nothing moves", () => {
    expect(followPlan({ change: "rewind", target: 10, oldLength: 10, newLength: 6, added: 0 })).toEqual({
      kind: "seek",
      to: 6,
    });
    expect(followPlan({ change: "rewind", target: 4, oldLength: 10, newLength: 6, added: 0 })).toEqual({
      kind: "none",
    });
  });

  test("a reset keeps the viewer's place, or the newest when following", () => {
    expect(followPlan({ change: "reset", target: 10, oldLength: 10, newLength: 12, added: 0 })).toEqual({
      kind: "seek",
      to: 12,
    });
    expect(followPlan({ change: "reset", target: 4, oldLength: 10, newLength: 12, added: 0 })).toEqual({
      kind: "seek",
      to: 4,
    });
    expect(followPlan({ change: "reset", target: 9, oldLength: 10, newLength: 6, added: 0 })).toEqual({
      kind: "seek",
      to: 6,
    });
  });

  test("the end moves nobody", () => {
    expect(followPlan({ ...base, change: "end", added: 0 })).toEqual({ kind: "none" });
  });

  test("following means at the newest position", () => {
    expect(isFollowing(10, 10)).toBe(true);
    expect(isFollowing(9, 10)).toBe(false);
  });
});
