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
  isPackCoverPath,
  webpSize,
} from "./packs.js";

describe("pack covers", () => {
  /** A RIFF/WEBP file whose first chunk is `chunk` with `body` from byte 20. */
  const webp = (chunk: string, body: number[]): Uint8Array => {
    const out = new Uint8Array(32);
    [..."RIFF"].forEach((c, i) => (out[i] = c.charCodeAt(0)));
    [...`WEBP${chunk}`].forEach((c, i) => (out[8 + i] = c.charCodeAt(0)));
    body.forEach((b, i) => (out[20 + i] = b));
    return out;
  };

  it("reads a lossy, lossless and extended WebP's size", () => {
    // VP8: frame tag, start code 9d 01 2a, then 14-bit width and height (600 = 0x258, 984 = 0x3d8).
    expect(webpSize(webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0x58, 0x02, 0xd8, 0x03]))).toEqual({
      width: 600,
      height: 984,
    });
    // VP8L: signature 0x2f, then width-1 and height-1 in 14 bits each: 599 | 983 << 14.
    const bits = 599 | (983 << 14);
    expect(webpSize(webp("VP8L", [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, bits >>> 24]))).toEqual({
      width: 600,
      height: 984,
    });
    // VP8X: flags, then width-1 and height-1 in 24 bits each.
    expect(webpSize(webp("VP8X", [0, 0, 0, 0, 0x57, 0x02, 0, 0xd7, 0x03, 0]))).toEqual({ width: 600, height: 984 });
  });

  it("is undefined for bytes that are not WebP", () => {
    expect(
      webpSize(new TextEncoder().encode("\x89PNG\r\n\x1a\n and some more bytes to be long enough")),
    ).toBeUndefined();
    expect(webpSize(new Uint8Array(4))).toBeUndefined();
    expect(webpSize(webp("VP8 ", [0, 0, 0, 1, 2, 3]))).toBeUndefined();
  });

  it("names a .webp file at a safe path", () => {
    expect(isPackCoverPath("cover.webp")).toBe(true);
    expect(isPackCoverPath("art/cover.webp")).toBe(true);
    expect(isPackCoverPath("cover.png")).toBe(false);
    expect(isPackCoverPath("../cover.webp")).toBe(false);
  });
});

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
