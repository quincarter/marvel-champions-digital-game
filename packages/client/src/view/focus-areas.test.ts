import { describe, expect, it } from "vitest";
import { AreaJump, areaOf, type FocusAreas } from "./focus-areas.js";

const areas: FocusAreas = {
  filters: ["search", "chip:a", "chip:b"],
  entry: "chip:a",
  list: ["row:1", "row:2", "row:3"],
};

describe("areaOf", () => {
  it("names the area a stop is in, and nothing for a stop in neither", () => {
    expect(areaOf("chip:b", areas)).toBe("filters");
    expect(areaOf("row:2", areas)).toBe("list");
    expect(areaOf("play", areas)).toBeNull();
    expect(areaOf(null, areas)).toBeNull();
  });
});

describe("AreaJump", () => {
  it("jumps from a list row to the first chip and back to the same row", () => {
    const jump = new AreaJump();
    expect(jump.toggle("row:3", areas)).toBe("chip:a");
    expect(jump.toggle("chip:b", areas)).toBe("row:3");
  });

  it("goes to the first row when focus never left one", () => {
    expect(new AreaJump().toggle("search", areas)).toBe("row:1");
  });

  it("forgets a row that left the list", () => {
    const jump = new AreaJump();
    jump.toFilters("row:3", areas);
    expect(jump.toggle("chip:a", { ...areas, list: ["row:1"] })).toBe("row:1");
  });

  it("sends focus from outside both areas to the filters without losing the row it left", () => {
    const jump = new AreaJump();
    jump.toFilters("row:2", areas);
    expect(jump.toggle("play", areas)).toBe("chip:a");
    expect(jump.toggle("chip:a", areas)).toBe("row:2");
  });

  it("has nowhere to go without a filter entry", () => {
    expect(new AreaJump().toFilters("row:1", { ...areas, entry: null })).toBeNull();
  });
});
