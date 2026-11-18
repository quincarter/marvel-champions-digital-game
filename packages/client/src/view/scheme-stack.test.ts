import { describe, expect, test } from "vitest";
import {
  STACK_SWIPE_IDLE_MS,
  STACK_SWIPE_PX,
  StackSwipe,
  stackFlip,
  stackFrontAfter,
  schemePickIds,
  stackShowsEligible,
} from "./scheme-stack.js";

describe("the scheme stack's front", () => {
  const ids = ["main", "side-a", "side-b", "side-c"];

  test("starts on the main scheme and keeps where the player put it", () => {
    expect(stackFrontAfter({ ids, front: null, targets: null, lastTargetsKey: null }).front).toBe("main");
    expect(stackFrontAfter({ ids, front: "side-b", targets: null, lastTargetsKey: null }).front).toBe("side-b");
  });

  test("a front that left play falls back to the first scheme", () => {
    expect(stackFrontAfter({ ids, front: "gone", targets: null, lastTargetsKey: null }).front).toBe("main");
  });

  test("a stale front never makes a prompt move the scheme already showing when it is a target", () => {
    const after = stackFrontAfter({ ids, front: "gone", targets: ["main", "side-c"], lastTargetsKey: null });
    expect(after.front).toBe("main");
  });

  test("a target prompt that opens brings its first target forward, once", () => {
    const opened = stackFrontAfter({ ids, front: "main", targets: ["side-b", "side-c"], lastTargetsKey: null });
    expect(opened).toEqual({ front: "side-b", targetsKey: "side-b,side-c" });
    // The player flips to another card while the same prompt is up: it stays.
    const again = stackFrontAfter({
      ids,
      front: "main",
      targets: ["side-b", "side-c"],
      lastTargetsKey: "side-b,side-c",
    });
    expect(again.front).toBe("main");
  });

  test("a prompt whose targets include the front leaves it, and one with no scheme targets changes nothing", () => {
    expect(stackFrontAfter({ ids, front: "side-c", targets: ["side-a", "side-c"], lastTargetsKey: null }).front).toBe(
      "side-c",
    );
    expect(stackFrontAfter({ ids, front: "side-a", targets: ["villain"], lastTargetsKey: null }).front).toBe("side-a");
  });

  test("flipping steps through the schemes and wraps round", () => {
    expect(stackFlip(ids, "main", 1)).toBe("side-a");
    expect(stackFlip(ids, "side-c", 1)).toBe("main");
    expect(stackFlip(ids, "main", -1)).toBe("side-c");
    expect(stackFlip(ids, null, 1)).toBe("side-a");
    expect(stackFlip([], null, 1)).toBeNull();
  });
});

describe("a swipe on the stack's front card", () => {
  test("flips once it has travelled far enough, even if the finger then rests", () => {
    const swipe = new StackSwipe();
    expect(swipe.step(-20, 0)).toBe(0);
    expect(swipe.step(-(STACK_SWIPE_PX - 20), 16)).toBe(1);
    // Further travel in the same swipe flips nothing more.
    expect(swipe.step(-60, 32)).toBe(0);
  });

  test("a swipe to the right goes back one", () => {
    expect(new StackSwipe().step(STACK_SWIPE_PX, 0)).toBe(-1);
  });

  test("a nudge after a pause never adds to an old drag", () => {
    const swipe = new StackSwipe();
    expect(swipe.step(-(STACK_SWIPE_PX - 5), 0)).toBe(0);
    expect(swipe.step(-10, STACK_SWIPE_IDLE_MS + 1)).toBe(0);
    swipe.end();
    expect(swipe.step(-(STACK_SWIPE_PX - 5), 1000)).toBe(0);
  });
});

describe("a prompt on the stack", () => {
  const order = ["main", "a", "b", "c", "d"];

  test("is answered on the stack while every scheme it can pick is the front card or a band", () => {
    expect(stackShowsEligible(order, ["main", "c"], 3)).toBe(true);
    expect(stackShowsEligible(order, [], 3)).toBe(true);
  });

  test("lists every scheme when one it can pick is hidden past the bands (a fifth scheme)", () => {
    expect(stackShowsEligible(order, ["a", "d"], 3)).toBe(false);
    expect(stackShowsEligible(order, ["b"], 1)).toBe(false);
  });
});

describe("the schemes a decision can pick", () => {
  const ids = ["main", "a", "b", "c", "d"];
  const all = (): boolean => true;

  test("a target, payment, divided power, discard or in-play cost picks on the table", () => {
    for (const mode of ["targeting", "paying", "dividingPower", "choosingDiscard", "choosingInPlayCost"])
      expect(
        schemePickIds(mode, ids, (id) => id === "d"),
        mode,
      ).toEqual(["d"]);
  });

  test("a decision asked on a sheet of its own picks no scheme, so five schemes keep their stack (review on #834)", () => {
    for (const mode of [
      "choosingForm",
      "choosingController",
      "choosingCostSelection",
      "confirmingAllianceHelp",
      "idle",
    ])
      expect(schemePickIds(mode, ids, all), mode).toEqual([]);
    expect(stackShowsEligible(ids, schemePickIds("choosingForm", ids, all), 3)).toBe(true);
  });
});
