import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { surface } from "../tokens.js";
import { schemeColor } from "./color-scheme.js";
import {
  FILL_STYLE_COLOR_AT,
  GRADIENT_FILL_COLORS_AT,
  LINE_STYLE_COLOR_AT,
  recolorBuffer,
  slotOf,
  type ColorSlot,
} from "./color-slots.js";

const graphicsSource = (): string => {
  const phaser = path.dirname(createRequire(import.meta.url).resolve("phaser/package.json"));
  return readFileSync(path.join(phaser, "src/gameobjects/graphics/Graphics.js"), "utf8").replace(/\s+/g, " ");
};

describe("Phaser's command buffer layout", () => {
  test("still pushes each style's color where the offsets say", () => {
    const source = graphicsSource();
    expect(source).toContain("Commands.FILL_STYLE, color, alpha );");
    expect(source).toContain("Commands.LINE_STYLE, lineWidth, color, alpha );");
    expect(source).toContain(
      "Commands.GRADIENT_FILL_STYLE, alphaTopLeft, alphaTopRight, alphaBottomLeft, alphaBottomRight, topLeft, topRight, bottomLeft, bottomRight );",
    );
    expect(FILL_STYLE_COLOR_AT).toBe(1);
    expect(LINE_STYLE_COLOR_AT).toBe(2);
    expect(GRADIENT_FILL_COLORS_AT).toEqual([5, 6, 7, 8]);
  });
});

describe("recolorBuffer", () => {
  // A buffer as Phaser builds it: FILL_STYLE (7), LINE_STYLE (6), a FILL_RECT (3) and a GRADIENT_FILL_STYLE (21).
  const build = (): { buffer: number[]; slots: ColorSlot[] } => {
    const paper = surface.paper.hex;
    const ink = surface.ink.hex;
    const buffer = [7, paper, 1, 6, 3, ink, 0.6, 3, 0, 0, 10, 10, 21, 1, 1, 0, 0, paper, paper, paper, paper];
    const slots = [
      slotOf(0, FILL_STYLE_COLOR_AT, paper, "fill"),
      slotOf(3, LINE_STYLE_COLOR_AT, ink, "line"),
      ...GRADIENT_FILL_COLORS_AT.map((at) => slotOf(12, at, paper, "fill")),
    ].filter((slot): slot is ColorSlot => slot !== null);
    return { buffer, slots };
  };

  test("swaps only the colors, never a width, an alpha or a coordinate", () => {
    const { buffer, slots } = build();
    const before = [...buffer];
    recolorBuffer(buffer, slots, "dark", "light");
    const changed = buffer.flatMap((value, i) => (value === before[i] ? [] : [i]));
    expect(changed).toEqual([1, 5, 17, 18, 19, 20]);
    expect(buffer[1]).toBe(schemeColor(surface.paper.hex, "fill", "dark"));
    expect(buffer[5]).toBe(schemeColor(surface.ink.hex, "line", "dark"));
    expect(buffer[6]).toBe(0.6);
  });

  test("dark to light to dark comes back to the same buffer", () => {
    const { buffer, slots } = build();
    const light = [...buffer];
    recolorBuffer(buffer, slots, "dark", "light");
    const dark = [...buffer];
    recolorBuffer(buffer, slots, "light", "dark");
    expect(buffer).toEqual(light);
    recolorBuffer(buffer, slots, "dark", "light");
    expect(buffer).toEqual(dark);
  });

  test("a color no scheme changes gets no slot", () => {
    expect(slotOf(0, FILL_STYLE_COLOR_AT, surface.ink.hex, "fill")).toBeNull();
    expect(slotOf(0, FILL_STYLE_COLOR_AT, 0xc8102e, "fill")).toBeNull();
  });
});
