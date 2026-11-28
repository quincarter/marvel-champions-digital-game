import { describe, expect, it } from "vitest";
import { t } from "../i18n/translate.js";
import { formatCount, oneDecimal } from "./number-format.js";

describe("oneDecimal", () => {
  it("writes one decimal with the language's own mark", () => {
    expect(oneDecimal(1.84, "en")).toBe("1.8");
    expect(oneDecimal(1.84, "es")).toBe("1,8");
    expect(oneDecimal(2, "es")).toBe("2,0");
  });

  it("makes the Decks stats curve heading read in Spanish: cost curve, average with a comma", () => {
    const heading = `${t("decks.stats.curve", undefined, "es")} · ${t("decks.stats.avg", { avg: oneDecimal(1.84, "es") }, "es")}`;
    expect(heading).toBe("Curva de costes · media 1,8");
  });
});

describe("formatCount", () => {
  it("groups a count the way the language does", () => {
    expect(formatCount(1065, "en")).toBe("1,065");
    expect(formatCount(1065, "es")).toBe("1065");
    expect(formatCount(12345, "es")).toBe("12.345");
  });
});
