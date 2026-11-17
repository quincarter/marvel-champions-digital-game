import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { font, WEB_FONTS } from "../tokens.js";

// Issue #767: the removal cost on an attachment chip is drawn from the community icon font.
const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

describe("the Champions icon font (#767)", () => {
  it("declares the v2 face under its family name, and keeps v1 beside it", () => {
    const css = read("./champions-icons.css");
    expect(css).toMatch(/font-family:\s*"Champions Icons"/);
    expect(css).toContain("ChampionsIcons2.ttf");
    expect(existsSync(new URL("./ChampionsIcons2.ttf", import.meta.url))).toBe(true);
    expect(existsSync(new URL("./ChampionsIcons.ttf", import.meta.url))).toBe(true);
  });

  it("is imported by main.ts and loaded before the first screen draws", () => {
    expect(read("../main.ts")).toContain('import "./fonts/champions-icons.css"');
    expect(WEB_FONTS.some((face) => face.includes(font.icons))).toBe(true);
  });
});
