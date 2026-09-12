import { describe, expect, it } from "vitest";
import { parseSeed } from "./seed.js";

describe("parseSeed", () => {
  it("parses plain digits", () => {
    expect(parseSeed("12345")).toBe(12345);
  });

  it("trims surrounding whitespace", () => {
    expect(parseSeed("  42  ")).toBe(42);
  });

  it("accepts leading zeros as the number they spell", () => {
    expect(parseSeed("007")).toBe(7);
  });

  it("accepts zero itself", () => {
    expect(parseSeed("0")).toBe(0);
  });

  it("rejects an empty field, distinctly from zero", () => {
    expect(parseSeed("")).toBeNull();
    expect(parseSeed("   ")).toBeNull();
  });

  it("rejects a negative sign", () => {
    expect(parseSeed("-5")).toBeNull();
  });

  it("rejects a decimal point", () => {
    expect(parseSeed("1.5")).toBeNull();
  });

  it("rejects non-digit characters", () => {
    expect(parseSeed("12a")).toBeNull();
    expect(parseSeed("1e5")).toBeNull();
  });

  it("rejects a value past safe-integer range", () => {
    expect(parseSeed("99999999999999999999")).toBeNull();
  });
});
