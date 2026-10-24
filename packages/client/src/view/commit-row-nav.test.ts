import { describe, expect, test } from "vitest";
import { commitStepDown, commitStepUp, nearestCommit } from "./commit-row-nav.js";
import type { Rect } from "./layout.js";

const r = (x: number, width = 100): Rect => ({ x, y: 0, width, height: 40 });
const rects: Record<string, Rect> = {
  "option:a": r(0),
  "option:f": r(1000),
  confirm: r(0, 200),
  decline: r(212, 150),
};
const rectOf = (key: string): Rect | undefined => rects[key];

describe("the opening hand's commit row", () => {
  test("Down from the leftmost card reaches Mulligan, from a far-right card the nearer Keep", () => {
    expect(commitStepDown("option:a", rectOf)).toBe("confirm");
    expect(commitStepDown("option:f", rectOf)).toBe("decline");
  });
  test("Down from anything but a card does nothing", () => {
    expect(commitStepDown("confirm", rectOf)).toBeNull();
    expect(commitStepDown(null, rectOf)).toBeNull();
  });
  test("a missing commit rect is skipped", () => {
    expect(nearestCommit(r(0), (k) => (k === "decline" ? rects.decline : undefined))).toBe("decline");
    expect(nearestCommit(r(0), () => undefined)).toBeNull();
  });
  test("Up returns to the card Down left from, while it is still in the route", () => {
    expect(commitStepUp("decline", "option:f", ["option:f", "confirm"])).toBe("option:f");
    expect(commitStepUp("decline", "option:gone", ["option:f"])).toBeNull();
    expect(commitStepUp("option:f", "option:f", ["option:f"])).toBeNull();
  });
});
