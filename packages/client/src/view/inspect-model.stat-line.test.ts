import { describe, expect, it } from "vitest";
import { statLineOf } from "./inspect-model.js";

describe("statLineOf (issue #635)", () => {
  it("names a minion's live HP beside its other stats", () => {
    expect(
      statLineOf([
        { label: "ATK", value: "2", bonus: 0 },
        { label: "SCH", value: "1", bonus: 0 },
        { label: "HP", value: "2/6", bonus: 0 },
      ]),
    ).toBe("ATK 2  ·  SCH 1  ·  HP 2/6");
  });

  it("says a modified stat in words", () => {
    expect(statLineOf([{ label: "THW", value: "3", bonus: 1 }])).toBe("THW 3 (+1)");
    expect(statLineOf([{ label: "ATK", value: "1", bonus: -1 }])).toBe("ATK 1 (−1)");
  });

  it("is empty for a card with no stats", () => {
    expect(statLineOf([])).toBe("");
  });
});
