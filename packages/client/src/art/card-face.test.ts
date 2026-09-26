import { describe, expect, it } from "vitest";

import {
  artDecodeSize,
  artPlacement,
  fitLine,
  fontString,
  measureBox,
  withAlpha,
  type FaceContext,
  type FaceFont,
} from "./card-face.js";

const body: FaceFont = {
  family: '"Public Sans", sans-serif',
  size: 9,
  weight: 800,
  letterSpacing: 1.2,
  padRight: 0,
  uppercase: true,
};

/** A context whose every character is `size * 0.5` wide at the current font's px size, with fixed metrics. */
function fakeContext(): FaceContext {
  const ctx = {
    font: "",
    measureText(text: string) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 0);
      return {
        width: text.length * size * 0.5,
        actualBoundingBoxAscent: size * 0.75,
        actualBoundingBoxDescent: size * 0.25,
      };
    },
  };
  return ctx as unknown as FaceContext;
}

describe("fontString", () => {
  it("builds Phaser's own font string: weight, size, family", () => {
    expect(fontString(body, 9, false)).toBe('800 9px "Public Sans", sans-serif');
    expect(fontString({ ...body, weight: 400 }, 22, false)).toBe('normal 22px "Public Sans", sans-serif');
  });

  it("applies the desktop size bump the way a Phaser Text does", () => {
    expect(fontString(body, 9, true)).toBe('800 11px "Public Sans", sans-serif');
    expect(fontString(body, 22, true)).toBe('800 22px "Public Sans", sans-serif');
  });
});

describe("measureBox", () => {
  it("measures letter-spaced text per character plus the spacing between them, rounded up, plus padding", () => {
    const ctx = fakeContext();
    // 4 chars × 4.5px + 3 gaps × 1.2 = 21.6 → 22, + 6 padding.
    const box = measureBox(ctx, "ABCD", { ...body, padRight: 6 }, 9, false);
    expect(box.width).toBe(28);
    expect(box.height).toBe(9);
    expect(box.baseline).toBe(7);
  });

  it("measures the desktop-bumped font, not the requested size", () => {
    const ctx = fakeContext();
    expect(measureBox(ctx, "AB", { ...body, letterSpacing: 0 }, 9, true).width).toBe(11);
  });
});

describe("fitLine", () => {
  const measure = (text: string, size: number) => ({ width: text.length * size });

  it("keeps the start size when the text already fits", () => {
    expect(fitLine(measure, "HULK", 100, 20, 8)).toEqual({ text: "HULK", size: 20 });
  });

  it("finds the largest size that fits", () => {
    // 10 chars: 12 → 120 fits 125, 13 → 130 doesn't.
    expect(fitLine(measure, "SPIDER-MAN", 125, 20, 8)).toEqual({ text: "SPIDER-MAN", size: 12 });
  });

  it("truncates with an ellipsis at the floor when no size fits", () => {
    // At 8px, "ABCDEFGHIJKLMNOPQRST" (20 chars) is 160; 64px holds 8 chars: 7 letters and the ellipsis.
    expect(fitLine(measure, "ABCDEFGHIJKLMNOPQRST", 64, 20, 8)).toEqual({ text: "ABCDEFG…", size: 8 });
  });

  it("never grows a label that started below the floor", () => {
    expect(fitLine(measure, "ABCDEFGHIJ", 30, 6, 8).size).toBe(6);
  });
});

describe("artPlacement", () => {
  it("cover-crops a tall picture around the focus line, filling the slot", () => {
    const place = artPlacement({ width: 1000, height: 2000 }, { width: 200, height: 200 }, "cover", 0.34);
    expect(place).toMatchObject({ sx: 0, sw: 1000, sh: 1000, dx: 0, dy: 0, dw: 200, dh: 200 });
    expect(place.sy).toBeCloseTo(340);
  });

  it("contains a picture centred, letterboxing the short side", () => {
    const place = artPlacement({ width: 100, height: 200 }, { width: 200, height: 200 }, "contain", 0.34);
    expect(place).toMatchObject({ sx: 0, sy: 0, sw: 100, sh: 200, dx: 50, dy: 0, dw: 100, dh: 200 });
  });

  it("crops the same whatever size the art was decoded at", () => {
    const full = artPlacement({ width: 2160, height: 3840 }, { width: 210, height: 300 }, "cover", 0.34);
    const small = artPlacement({ width: 432, height: 768 }, { width: 210, height: 300 }, "cover", 0.34);
    expect(small.sx / 432).toBeCloseTo(full.sx / 2160);
    expect(small.sy / 768).toBeCloseTo(full.sy / 3840);
  });
});

describe("artDecodeSize", () => {
  it("decodes a huge picture at what the card shows at the device resolution", () => {
    expect(artDecodeSize({ width: 2160, height: 3840 }, { width: 210, height: 300 }, "cover", 2)).toEqual({
      width: 420,
      height: 747,
    });
  });

  it("never upscales a picture smaller than the card", () => {
    expect(artDecodeSize({ width: 399, height: 501 }, { width: 210, height: 300 }, "cover", 2)).toEqual({
      width: 399,
      height: 501,
    });
  });
});

describe("withAlpha", () => {
  it("writes the colour as cssOf would", () => {
    expect(withAlpha("#14110e", 1)).toBe("#14110e");
    expect(withAlpha("#14110e", 0.38)).toBe("rgba(20,17,14,0.38)");
  });
});
