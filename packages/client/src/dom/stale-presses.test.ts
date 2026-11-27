import { describe, expect, it } from "vitest";
import { commandMeaning, staleKeys } from "./stale-presses.js";

describe("staleKeys", () => {
  it("names a key whose command changed (Ask became Leave), and not new or unchanged ones", () => {
    const before = new Map([
      ["seat:s1", "primary|Ask|true"],
      ["seat:s2", "primary|Take|true"],
    ]);
    const after = new Map([
      ["seat:s1", "secondary|Leave|true"],
      ["seat:s2", "primary|Take|true"],
      ["seat:s3", "primary|Ask|true"],
    ]);
    expect(staleKeys(before, after)).toEqual(["seat:s1"]);
  });
});

describe("the same-looking Remove for another person", () => {
  it("is a different meaning, so a press armed on Player A does not remove Player B", () => {
    const a = new Map([["seat:s1", commandMeaning("remove|pA", "secondary", "Remove", true)]]);
    const b = new Map([["seat:s1", commandMeaning("remove|pB", "secondary", "Remove", true)]]);
    expect(staleKeys(a, b)).toEqual(["seat:s1"]);
    expect(staleKeys(a, a)).toEqual([]);
  });
});
