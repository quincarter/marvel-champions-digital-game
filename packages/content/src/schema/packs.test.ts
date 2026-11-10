import { describe, expect, it } from "vitest";
import {
  customCardPrefix,
  isCustomCardCode,
  isLanguageTag,
  isPackId,
  isSafePackPath,
  packCardImagePath,
  packIdOfCardCode,
  parsePackCardImagePath,
  resolvePackCardImage,
} from "./packs.js";

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

describe("per-language pack pictures", () => {
  const languages = { base: "en", available: ["en", "es"] } as const;
  const files = new Set(["cards/en/x.a.01a.webp", "cards/es/x.a.01a.webp", "cards/en/x.a.02.webp"]);
  const has = (path: string): boolean => files.has(path);

  it("names the picture path and reads it back", () => {
    expect(packCardImagePath("es", "x.a.01a")).toBe("cards/es/x.a.01a.webp");
    expect(parsePackCardImagePath("cards/es/x.a.01a.webp")).toEqual({ lang: "es", code: "x.a.01a" });
    expect(parsePackCardImagePath("art/hero.webp")).toBeUndefined();
    expect(parsePackCardImagePath("cards/es/sub/x.webp")).toBeUndefined();
  });

  it("uses the wanted language where the pack has it", () => {
    expect(resolvePackCardImage(languages, "x.a.01a", "es", has)).toBe("cards/es/x.a.01a.webp");
  });

  it("falls back to the base language for a card the translation lacks", () => {
    expect(resolvePackCardImage(languages, "x.a.02", "es", has)).toBe("cards/en/x.a.02.webp");
  });

  it("falls back for a language the pack does not carry, and gives nothing for a missing card or no languages", () => {
    expect(resolvePackCardImage(languages, "x.a.01a", "fr", has)).toBe("cards/en/x.a.01a.webp");
    expect(resolvePackCardImage(languages, "x.a.99", "en", has)).toBeUndefined();
    expect(resolvePackCardImage(undefined, "x.a.01a", "en", has)).toBeUndefined();
  });

  it("accepts language tags a folder name can carry", () => {
    expect(isLanguageTag("es")).toBe(true);
    expect(isLanguageTag("pt-BR")).toBe(true);
    expect(isLanguageTag("EN")).toBe(false);
    expect(isLanguageTag("e")).toBe(false);
    expect(isLanguageTag("../x")).toBe(false);
  });
});
