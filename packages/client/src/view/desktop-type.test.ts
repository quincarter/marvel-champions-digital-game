import { describe, expect, it } from "vitest";
import { desktopFont, desktopTypeSize } from "./desktop-type.js";

describe("desktop type", () => {
  it("bumps small sizes on desktop, capped below the next step up", () => {
    expect([8, 9, 10, 11, 12].map((size) => desktopTypeSize(size, true))).toEqual([10, 11, 12, 13, 13]);
  });

  it("leaves larger sizes and every non-desktop size alone", () => {
    expect(desktopTypeSize(13, true)).toBe(13);
    expect(desktopTypeSize(22, true)).toBe(22);
    expect(desktopTypeSize(9, false)).toBe(9);
  });

  it("swaps only the px size inside a CSS font string", () => {
    expect(desktopFont('800 11px "Public Sans", sans-serif', true)).toBe('800 13px "Public Sans", sans-serif');
    expect(desktopFont('normal 22px "Bangers", sans-serif', true)).toBe('normal 22px "Bangers", sans-serif');
    expect(desktopFont('800 11px "Public Sans", sans-serif', false)).toBe('800 11px "Public Sans", sans-serif');
  });
});
