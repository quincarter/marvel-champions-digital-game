import { describe, expect, it } from "vitest";
import { layoutText, primaryFamily, WidthCache, workerCanPaint, type LayoutInput } from "./text-layout.js";

/** Every character is 10 wide, so a line's width is easy to read off. */
const tenPerChar = (text: string): number => text.length * 10;

const base: LayoutInput = {
  lines: ["abcd"],
  metrics: { ascent: 12, fontSize: 16 },
  strokeThickness: 0,
  letterSpacing: 0,
  lineSpacing: 0,
  maxLines: 0,
  fixedWidth: 0,
  fixedHeight: 0,
  padding: { left: 0, right: 0, top: 0, bottom: 0 },
  align: "left",
  resolution: 1,
  autoRound: true,
};

describe("layoutText (Text.updateText's measuring half)", () => {
  it("sizes a one-line label from the widest line and the font's height", () => {
    const layout = layoutText(base, tenPerChar);
    expect(layout.width).toBe(40);
    expect(layout.height).toBe(16);
    expect(layout.lines).toEqual([{ text: "abcd", x: 0, y: 12 }]);
  });

  it("stacks lines by line height plus line spacing, from the first baseline", () => {
    const layout = layoutText({ ...base, lines: ["ab", "abcd", "a"], lineSpacing: 3 }, tenPerChar);
    expect(layout.width).toBe(40);
    expect(layout.height).toBe(16 * 3 + 3 * 2);
    expect(layout.lines.map((line) => line.y)).toEqual([12, 12 + 16 + 3, 12 + 32 + 6]);
  });

  it("aligns each line within the widest, rounding the way autoRound does", () => {
    const lines = ["ab", "abcde", "a"];
    const center = layoutText({ ...base, lines, align: "center" }, tenPerChar);
    expect(center.lines.map((line) => line.x)).toEqual([15, 0, 20]);
    const right = layoutText({ ...base, lines, align: "right" }, tenPerChar);
    expect(right.lines.map((line) => line.x)).toEqual([30, 0, 40]);
    const odd = layoutText({ ...base, lines: ["a", "abc"], align: "center" }, tenPerChar);
    expect(odd.lines[0]!.x).toBe(10);
    const unrounded = layoutText({ ...base, lines: ["a", "abcde"], align: "center", autoRound: false }, tenPerChar);
    expect(unrounded.lines[0]!.x).toBe(20);
    const half = layoutText({ ...base, lines: ["a", "abcd"], align: "center", autoRound: false }, tenPerChar);
    expect(half.lines[0]!.x).toBe(15);
  });

  it("adds stroke to every line's width and height, and offsets by half of it", () => {
    const layout = layoutText({ ...base, strokeThickness: 4 }, tenPerChar);
    expect(layout.width).toBe(44);
    expect(layout.height).toBe(20);
    expect(layout.lines[0]).toEqual({ text: "abcd", x: 2, y: 2 + 12 });
  });

  it("measures letter-spaced text a character at a time", () => {
    const calls: string[] = [];
    const layout = layoutText({ ...base, letterSpacing: 2 }, (text) => {
      calls.push(text);
      return 10;
    });
    expect(calls).toEqual(["a", "b", "c", "d"]);
    expect(layout.width).toBe(40 + 2 * 3);
  });

  it("rounds a line's width up, and pads and scales the canvas", () => {
    const layout = layoutText(
      { ...base, padding: { left: 3, right: 5, top: 2, bottom: 4 }, resolution: 2 },
      () => 10.2,
    );
    expect(layout.width).toBe(11 + 8);
    expect(layout.height).toBe(16 + 6);
    expect(layout.canvasWidth).toBe(38);
    expect(layout.canvasHeight).toBe(44);
  });

  it("holds to a fixed size, never letting the text overflow its box width", () => {
    const fixed = layoutText({ ...base, fixedWidth: 100, fixedHeight: 50, align: "right" }, tenPerChar);
    expect(fixed.width).toBe(100);
    expect(fixed.height).toBe(50);
    expect(fixed.lines[0]!.x).toBe(60);
    const narrow = layoutText({ ...base, fixedWidth: 20, align: "right" }, tenPerChar);
    expect(narrow.width).toBe(20);
    expect(narrow.lines[0]!.x).toBe(0);
  });

  it("draws at most maxLines lines", () => {
    const layout = layoutText({ ...base, lines: ["a", "b", "c"], maxLines: 2 }, tenPerChar);
    expect(layout.lines.map((line) => line.text)).toEqual(["a", "b"]);
    expect(layout.height).toBe(32);
  });

  it("never makes a canvas smaller than one pixel", () => {
    const layout = layoutText({ ...base, lines: [""], metrics: { ascent: 0, fontSize: 0 } }, tenPerChar);
    expect(layout.canvasWidth).toBe(1);
    expect(layout.canvasHeight).toBe(1);
  });
});

describe("workerCanPaint", () => {
  const families = new Set(["Public Sans", "Bangers"]);
  const ok = {
    rtl: false,
    align: "left",
    wordWrapCallback: null,
    fontFamily: '"Public Sans", sans-serif',
    resolution: 2,
  };

  it("accepts the app's faces in plain left-to-right text", () => {
    expect(workerCanPaint(ok, families)).toBe(true);
    expect(workerCanPaint({ ...ok, align: "center", fontFamily: "Bangers" }, families)).toBe(true);
  });

  it("keeps the unusual on the main thread", () => {
    expect(workerCanPaint({ ...ok, rtl: true }, families)).toBe(false);
    expect(workerCanPaint({ ...ok, align: "justify" }, families)).toBe(false);
    expect(workerCanPaint({ ...ok, wordWrapCallback: () => [] }, families)).toBe(false);
    expect(workerCanPaint({ ...ok, fontFamily: "Courier" }, families)).toBe(false);
    expect(workerCanPaint({ ...ok, resolution: 0 }, families)).toBe(false);
  });

  it("reads the first family of a stack", () => {
    expect(primaryFamily('"IBM Plex Mono", monospace')).toBe("IBM Plex Mono");
    expect(primaryFamily("Bangers")).toBe("Bangers");
    expect(primaryFamily("'Public Sans'")).toBe("Public Sans");
  });
});

describe("WidthCache", () => {
  it("measures a font and text once, and only when the font is ready", () => {
    let ready = false;
    const cache = new WidthCache(() => ready);
    let measured = 0;
    const measure = (): number => {
      measured++;
      return 42;
    };
    expect(cache.widthOf("12px A", "hi", measure)).toBe(42);
    expect(cache.widthOf("12px A", "hi", measure)).toBe(42);
    expect(measured).toBe(2);
    ready = true;
    cache.widthOf("12px A", "hi", measure);
    cache.widthOf("12px A", "hi", measure);
    cache.widthOf("12px B", "hi", measure);
    expect(measured).toBe(4);
    expect(cache.hits).toBe(1);
  });

  it("is cleared when it fills rather than growing without bound", () => {
    const cache = new WidthCache(() => true, 2);
    let measured = 0;
    const measure = (): number => ++measured;
    cache.widthOf("f", "a", measure);
    cache.widthOf("f", "b", measure);
    cache.widthOf("f", "c", measure);
    expect(cache.widthOf("f", "c", measure)).toBe(3);
    expect(cache.widthOf("f", "a", measure)).toBe(4);
  });
});
