import { describe, expect, it } from "vitest";
import { staleKeys } from "./stale-presses.js";

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
