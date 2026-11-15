import { describe, expect, it } from "vitest";
import { CARD_LANGUAGES } from "../art/card-language.js";
import { en } from "./en.js";
import { CATALOGS, fill, pluralFrom, messageFrom, placeholdersOf, t, tPlural, type MessageKey } from "./translate.js";

describe("translated app text (#390)", () => {
  it("gives the picked language's message", () => {
    expect(t("title.newGame", undefined, "es")).toBe("Nueva partida");
    expect(t("title.newGame", undefined, "en")).toBe("New game");
  });

  it("falls back to English for a key the language has no translation for", () => {
    expect(messageFrom({ "title.campaign": "Campaña" }, "title.newGame")).toBe("New game");
    expect(messageFrom({ "title.campaign": "Campaña" }, "title.campaign")).toBe("Campaña");
  });

  it("fills {name} placeholders and leaves an unknown one as it is", () => {
    expect(fill("{who} took {n} damage", { who: "Rhino", n: 3 })).toBe("Rhino took 3 damage");
    expect(fill("{who} took {n} damage", { who: "Rhino" })).toBe("Rhino took {n} damage");
    expect(fill("{constructor}", {})).toBe("{constructor}"); // only the params' own names
    expect(placeholdersOf("{b} and {a}, {a}")).toEqual(["a", "b"]);
  });
});

describe("plural messages", () => {
  it("falls back to English in English's own plural form, not the language's", () => {
    // Russian calls 21 "one"; English calls it "other".
    expect(pluralFrom({}, "ru", "scenario.wins", 21)).toBe("21 wins");
    expect(pluralFrom({}, "ru", "scenario.wins", 1)).toBe("1 win");
  });

  it("picks the singular for one and the plural otherwise, per language", () => {
    expect(tPlural("scenario.wins", 1, undefined, "en")).toBe("1 win");
    expect(tPlural("scenario.wins", 3, undefined, "en")).toBe("3 wins");
    expect(tPlural("scenario.wins", 0, undefined, "en")).toBe("0 wins");
    expect(tPlural("scenario.wins", 1, undefined, "es")).toBe("1 victoria");
    expect(tPlural("scenario.wins", 0, undefined, "es")).toBe("0 victorias");
    expect(tPlural("scenario.wins", 2, undefined, "es")).toBe("2 victorias");
  });
});

describe("every catalog against English", () => {
  for (const lang of CARD_LANGUAGES) {
    const catalog = CATALOGS[lang] as Record<string, string | undefined>;

    it(`${lang} has no key English lacks`, () => {
      expect(Object.keys(catalog).filter((key) => !(key in en))).toEqual([]);
    });

    it(`${lang} keeps each message's {placeholders}`, () => {
      const mismatched = Object.entries(catalog)
        .filter(([key, text]) => text !== undefined && key in en)
        .filter(([key, text]) => placeholdersOf(text!).join() !== placeholdersOf(en[key as MessageKey]).join())
        .map(([key]) => key);
      expect(mismatched).toEqual([]);
    });

    it(`${lang} gives each plural message its _one and _other together`, () => {
      const keys = new Set(Object.keys(catalog));
      const lonely = [...keys].filter((key) => key.endsWith("_one") && !keys.has(key.replace(/_one$/, "_other")));
      expect(lonely).toEqual([]);
    });

    it(`${lang} gives each plural message its _one with its _other`, () => {
      const keys = new Set(Object.keys(catalog));
      const lonely = [...keys].filter((key) => key.endsWith("_other") && !keys.has(key.replace(/_other$/, "_one")));
      expect(lonely).toEqual([]);
    });

    it(`${lang} has no empty message`, () => {
      expect(Object.entries(catalog).filter(([, text]) => text !== undefined && text.trim() === "")).toEqual([]);
    });
  }
});
