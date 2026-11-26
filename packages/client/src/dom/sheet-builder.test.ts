import { describe, expect, it } from "vitest";
import { accent, surface } from "../tokens.js";
import { sheetColor } from "./sheet-builder.js";

describe("sheetColor", () => {
  it("draws a token through the panel layer's variable for its channel, so dark mode maps it", () => {
    expect(sheetColor(surface.ink.hex, "text")).toBe(`var(--mc-text-ink, ${surface.ink.css})`);
    expect(sheetColor(accent.heroRed.hex, "fill")).toBe(`var(--mc-fill-red, ${accent.heroRed.css})`);
    expect(sheetColor(surface.inkOnHue.hex, "text")).toBe(`var(--mc-text-ink-on-hue, ${surface.inkOnHue.css})`);
  });

  it("draws a color that is no token as it is", () => {
    expect(sheetColor(0x123456, "fill")).toBe("#123456");
  });
});
