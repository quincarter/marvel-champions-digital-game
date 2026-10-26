import { describe, expect, it } from "vitest";
import { tabEndLabels } from "./tab-strip-hints.js";

describe("tabEndLabels", () => {
  it("keeps the middle of the first and last cells clear", () => {
    const [first, last] = tabEndLabels({ x: 0, y: 60, width: 400, height: 44 }, 4);
    expect(first).toEqual({ x: 20, y: 60, width: 60, height: 44 });
    expect(last).toEqual({ x: 320, y: 60, width: 60, height: 44 });
  });

  it("names one label for a one-tab strip and none for an empty one", () => {
    expect(tabEndLabels({ x: 0, y: 0, width: 100, height: 40 }, 1)).toHaveLength(1);
    expect(tabEndLabels({ x: 0, y: 0, width: 100, height: 40 }, 0)).toEqual([]);
  });
});
