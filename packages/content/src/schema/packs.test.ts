import { describe, expect, it } from "vitest";
import { customCardPrefix, isCustomCardCode, isPackId, isSafePackPath, packIdOfCardCode } from "./packs.js";

describe("custom pack ids and codes", () => {
  it("accepts kebab-case pack ids only", () => {
    expect(isPackId("fan-gwenpool")).toBe(true);
    expect(isPackId("Fan-Gwenpool")).toBe(false);
    expect(isPackId("fan--x")).toBe(false);
    expect(isPackId("")).toBe(false);
  });

  it("namespaces custom card codes under x.<pack-id>.", () => {
    expect(customCardPrefix("fan-gwenpool")).toBe("x.fan-gwenpool.");
    expect(isCustomCardCode("x.fan-gwenpool.01a")).toBe(true);
    expect(isCustomCardCode("01001a")).toBe(false);
    expect(packIdOfCardCode("x.fan-gwenpool.01a")).toBe("fan-gwenpool");
    expect(packIdOfCardCode("01001a")).toBeUndefined();
  });

  it("rejects pack paths that could escape the pack", () => {
    expect(isSafePackPath("cards/x.a.01.webp")).toBe(true);
    expect(isSafePackPath("../secret")).toBe(false);
    expect(isSafePackPath("/abs")).toBe(false);
    expect(isSafePackPath("a//b")).toBe(false);
    expect(isSafePackPath(String.raw`a\b`)).toBe(false);
  });
});
