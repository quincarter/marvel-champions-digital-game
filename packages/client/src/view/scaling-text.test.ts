import { describe, expect, test } from "vitest";
import { formatScaling } from "./scaling-text.js";

describe("formatScaling", () => {
  test("flat value: just the number", () => {
    expect(formatScaling({ base: 12, perPlayer: 0 })).toBe("12");
  });

  test("per-player only", () => {
    expect(formatScaling({ base: 0, perPlayer: 3 })).toBe("3 per player");
  });

  test("base plus per-player", () => {
    expect(formatScaling({ base: 10, perPlayer: 1 })).toBe("10 (+1 per player)");
  });

  test("zero is still a flat value, not a per-player one", () => {
    expect(formatScaling({ base: 0, perPlayer: 0 })).toBe("0");
  });
});
