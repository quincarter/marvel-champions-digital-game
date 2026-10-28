import { describe, expect, test } from "vitest";
import { surface, accent, signal } from "../tokens.js";
import {
  colorScheme,
  isSchemeColor,
  onColorSchemeChange,
  schemeColor,
  schemeCss,
  setColorScheme,
} from "./color-scheme.js";

describe("schemeColor", () => {
  test("light is every token as written", () => {
    for (const token of [surface.paper, surface.ink, surface.card, accent.heroRed]) {
      expect(schemeColor(token.hex, "fill", "light")).toBe(token.hex);
    }
  });

  test("dark steps the light grounds down and keeps their depth order", () => {
    const lum = (hex: number): number => ((hex >> 16) & 0xff) + ((hex >> 8) & 0xff) + (hex & 0xff);
    const ink = schemeColor(surface.ink.hex, "fill", "dark");
    const parchment = schemeColor(surface.parchment.hex, "fill", "dark");
    const paper = schemeColor(surface.paper.hex, "fill", "dark");
    const card = schemeColor(surface.card.hex, "fill", "dark");
    expect(ink).toBe(surface.ink.hex);
    expect(lum(ink)).toBeLessThan(lum(parchment));
    expect(lum(parchment)).toBeLessThan(lum(paper));
    expect(lum(paper)).toBeLessThan(lum(card));
    expect(lum(card)).toBeLessThan(lum(surface.paper.hex) / 2);
  });

  test("ink text and ink borders turn light; paper text stays", () => {
    expect(schemeColor(surface.ink.hex, "text", "dark")).not.toBe(surface.ink.hex);
    expect(schemeColor(surface.ink.hex, "line", "dark")).not.toBe(surface.ink.hex);
    expect(schemeColor(surface.paper.hex, "text", "dark")).toBe(surface.paper.hex);
  });

  test("hues and ink on a hue never change", () => {
    for (const hex of [accent.heroRed.hex, signal.caution.hex, signal.cost.hex, surface.inkOnHue.hex]) {
      for (const channel of ["fill", "line", "text"] as const) expect(schemeColor(hex, channel, "dark")).toBe(hex);
    }
  });

  test("dark goes back to light exactly", () => {
    for (const channel of ["fill", "line", "text"] as const) {
      for (const token of [surface.paper, surface.parchment, surface.card, surface.ink]) {
        const dark = schemeColor(token.hex, channel, "dark");
        expect(schemeColor(dark, channel, "light", "dark")).toBe(token.hex);
        expect(isSchemeColor(dark, channel)).toBe(dark !== token.hex);
      }
    }
  });
});

describe("schemeCss", () => {
  test("maps hex and rgba strings, keeping alpha", () => {
    const dark = schemeColor(surface.ink.hex, "text", "dark");
    expect(schemeCss(surface.ink.css, "text", "dark")).toBe(`#${dark.toString(16).padStart(6, "0")}`);
    expect(schemeCss("rgba(20,17,14,0.5)", "text", "dark")).toBe(
      `rgba(${(dark >> 16) & 0xff},${(dark >> 8) & 0xff},${dark & 0xff},0.5)`,
    );
    expect(schemeCss("#fff", "fill", "dark")).not.toBe("#fff");
  });

  test("leaves anything it can't read alone", () => {
    expect(schemeCss("transparent", "fill", "dark")).toBe("transparent");
    expect(schemeCss("#c8102e", "fill", "dark")).toBe("#c8102e");
  });
});

describe("setColorScheme", () => {
  test("tells listeners about a real change only", () => {
    const heard: string[] = [];
    const off = onColorSchemeChange((next, previous) => heard.push(`${previous}>${next}`));
    setColorScheme("dark");
    setColorScheme("dark");
    expect(colorScheme()).toBe("dark");
    setColorScheme("light");
    off();
    setColorScheme("dark");
    setColorScheme("light");
    expect(heard).toEqual(["light>dark", "dark>light"]);
  });
});
