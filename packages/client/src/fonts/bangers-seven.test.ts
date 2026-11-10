import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WEB_FONT_SAMPLE } from "../tokens.js";

// Issue #660: Bangers' own 7 reads as a 1 ("7 / 14" HP read "1 / 14"), so a crossed 7 sits over it.
const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

describe("the crossed Bangers 7 (#660)", () => {
  it("is a Bangers face for the 7 alone", () => {
    const css = read("./bangers-seven.css");
    expect(css).toMatch(/font-family:\s*"Bangers"/);
    expect(css).toMatch(/unicode-range:\s*U\+0037;/);
  });

  it("is imported after @fontsource's Bangers, so it is the face checked first for a 7", () => {
    const main = read("../main.ts");
    const bangers = main.indexOf('import "@fontsource/bangers/400.css"');
    const seven = main.indexOf('import "./fonts/bangers-seven.css"');
    expect(bangers).toBeGreaterThanOrEqual(0);
    expect(seven).toBeGreaterThan(bangers);
  });

  it("is loaded before the first screen draws", () => {
    expect(WEB_FONT_SAMPLE).toContain("7");
  });
});
