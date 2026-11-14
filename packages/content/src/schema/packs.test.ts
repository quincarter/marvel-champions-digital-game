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
  packAchievementProblems,
  parsePackAchievements,
  PACK_ACHIEVEMENTS_MAX,
  webpSize,
} from "./packs.js";

describe("pack covers", () => {
  /** A RIFF/WEBP file whose first chunk is `chunk` with `body` from byte 20. */
  const webp = (chunk: string, body: number[]): Uint8Array => {
    const out = new Uint8Array(32);
    [..."RIFF"].forEach((c, i) => (out[i] = c.charCodeAt(0)));
    out[4] = out.length - 8;
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
    // Truncated: the RIFF header promises more bytes than the file has.
    const whole = webp("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, 0x58, 0x02, 0xd8, 0x03]);
    expect(webpSize(whole)).toBeDefined();
    expect(webpSize(whole.subarray(0, 31))).toBeUndefined();
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

describe("pack achievements", () => {
  const context = {
    packId: "demo",
    heroIds: new Set(["x.demo.01a"]),
    scenarioIds: new Set(["demo-menace"]),
    campaignIds: new Set(["demo-saga"]),
    houseRuleToggle: false,
  };
  const one = (when: unknown, over: Record<string, unknown> = {}) => [
    { id: "a-one", name: "A One", description: "Does a thing.", when, ...over },
  ];
  const problems = (list: unknown, ctx = context) => packAchievementProblems(list, ctx).join("\n");

  it("accepts each measure with the filters that name the pack's own content", () => {
    expect(problems(undefined)).toBe("");
    expect(problems(one({ win: true, hero: "x.demo.01a", expert: true }))).toBe("");
    expect(problems(one({ play: true, villain: "demo-menace" }))).toBe("");
    expect(problems(one({ gamesWon: 5 }))).toBe("");
    expect(problems(one({ gamesPlayed: 10, hero: "x.demo.01a" }))).toBe("");
    expect(problems(one({ campaignWon: "demo-saga" }))).toBe("");
    expect(problems(one({ win: true, houseRule: "demo" }), { ...context, houseRuleToggle: true })).toBe("");
  });

  it("needs exactly one measure, and refuses unknown conditions", () => {
    expect(problems(one({}))).toContain("exactly one of");
    expect(problems(one({ win: true, play: true }))).toContain("exactly one of");
    expect(problems(one({ expert: true }))).toContain("exactly one of");
    expect(problems(one({ win: true, code: "alert(1)" }))).toContain("when.code is not a condition");
    expect(problems(one("win"))).toContain("when must be a condition object");
    expect(problems(one({ win: true }, { extra: 1 }))).toContain("extra is not an achievement field");
  });

  it("checks values: flags are true, counts are whole numbers in range, ids are text", () => {
    expect(problems(one({ win: false }))).toContain("when.win must be true");
    expect(problems(one({ gamesWon: 0 }))).toContain("when.gamesWon must be a whole number");
    expect(problems(one({ gamesWon: 2.5 }))).toContain("when.gamesWon must be a whole number");
    expect(problems(one({ gamesPlayed: 1001 }))).toContain("when.gamesPlayed must be a whole number");
    expect(problems(one({ win: true, hero: 7 }))).toContain("when.hero must be an id");
    expect(problems(one({ campaignWon: "demo-saga", expert: true }))).toContain("takes no filters");
  });

  it("only lets conditions name the pack's own heroes, scenarios, campaigns and house rule", () => {
    expect(problems(one({ win: true, hero: "x.other.01a" }))).toContain("is not one of this pack's heroes");
    expect(problems(one({ win: true, hero: "01001a" }))).toContain("is not one of this pack's heroes");
    expect(problems(one({ win: true, villain: "rhino" }))).toContain("is not one of this pack's scenarios");
    expect(problems(one({ campaignWon: "other-saga" }))).toContain("is not one of this pack's campaigns");
    expect(problems(one({ win: true, houseRule: "other" }))).toContain("must be this pack's own id");
    expect(problems(one({ win: true, houseRule: "demo" }))).toContain("needs a house-rule pack");
  });

  it("limits ids, text lengths and the count, and wants ids unique in the pack", () => {
    expect(problems(one({ win: true }, { id: "Bad Id" }))).toContain("id must be lowercase");
    expect(problems(one({ win: true }, { name: "n".repeat(49) }))).toContain("name is 49 characters");
    expect(problems(one({ win: true }, { description: "" }))).toContain("description must be non-empty");
    expect(problems(one({ win: true }, { description: "d".repeat(161) }))).toContain("description is 161 characters");
    const twice = [...one({ win: true }), ...one({ play: true })];
    expect(problems(twice)).toContain('id "a-one" is used by two achievements');
    const many = Array.from({ length: PACK_ACHIEVEMENTS_MAX + 1 }, (_, i) => ({
      id: `a-${i}`,
      name: "N",
      description: "D",
      when: { win: true },
    }));
    expect(problems(many)).toContain("over the 24 limit");
    expect(problems({ id: "x" })).toContain("must be a list");
  });

  it("parses untrusted data down to the well-formed entries, once each", () => {
    const parsed = parsePackAchievements([
      ...one({ win: true }),
      ...one({ play: true }),
      { id: "bad", name: "x", description: "y", when: { hax: 1 } },
      "nope",
    ]);
    expect(parsed).toEqual([{ id: "a-one", name: "A One", description: "Does a thing.", when: { win: true } }]);
    expect(parsePackAchievements("nope")).toEqual([]);
    expect(parsePackAchievements(undefined)).toEqual([]);
  });
});
