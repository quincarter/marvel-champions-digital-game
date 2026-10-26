import { describe, expect, it } from "vitest";
import { isSamePress } from "./press-settle.js";

describe("isSamePress", () => {
  it("is never the same press before any toggle", () => {
    expect(isSamePress(null, 10)).toBe(false);
  });
  it("makes an expand right after a collapse in the same frame a no-op", () => {
    expect(isSamePress(10, 10)).toBe(true);
  });
  it("lets a press on a later frame through, however soon", () => {
    expect(isSamePress(10, 11)).toBe(false);
    expect(isSamePress(10, 500)).toBe(false);
  });
});
