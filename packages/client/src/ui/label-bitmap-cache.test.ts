import { describe, expect, it } from "vitest";
import { LabelBitmapCache, labelKeyOf, type CachedLabel } from "./label-bitmap-cache.js";
import type { PaintJob } from "./text-paint-protocol.js";

const label = (width: number, height: number): CachedLabel => ({
  canvas: { width, height } as HTMLCanvasElement,
  canvasWidth: width,
  canvasHeight: height,
  resolution: 1,
});

const job = (overrides: Partial<Omit<PaintJob, "id">> = {}): Omit<PaintJob, "id"> => ({
  width: 40,
  height: 16,
  resolution: 1,
  font: "700 12px Public Sans",
  background: null,
  paddingLeft: 0,
  paddingTop: 0,
  fill: "#000",
  stroke: "#fff",
  strokeThickness: 0,
  letterSpacing: 0,
  shadow: { offsetX: 0, offsetY: 0, color: "#000", blur: 0, fill: false, stroke: false },
  lines: [{ text: "LOCKED", x: 0, y: 12 }],
  ...overrides,
});

describe("labelKeyOf", () => {
  it("is the same for the same paint", () => {
    expect(labelKeyOf(job())).toBe(labelKeyOf(job()));
  });

  it("differs when anything the pixels depend on differs", () => {
    const base = labelKeyOf(job());
    expect(labelKeyOf(job({ fill: "#f00" }))).not.toBe(base);
    expect(labelKeyOf(job({ lines: [{ text: "OPEN", x: 0, y: 12 }] }))).not.toBe(base);
    expect(labelKeyOf(job({ lines: [{ text: "LOCKED", x: 1, y: 12 }] }))).not.toBe(base);
    expect(labelKeyOf(job({ resolution: 2 }))).not.toBe(base);
    expect(labelKeyOf(job({ font: "700 13px Public Sans" }))).not.toBe(base);
    expect(labelKeyOf(job({ shadow: { ...job().shadow, blur: 2 } }))).not.toBe(base);
  });
});

describe("LabelBitmapCache", () => {
  it("returns what was kept", () => {
    const cache = new LabelBitmapCache();
    const kept = label(10, 10);
    cache.set("a", kept);
    expect(cache.get("a")).toBe(kept);
    expect(cache.get("b")).toBeUndefined();
  });

  it("drops the least recently used labels past its byte budget", () => {
    // 10x10 labels are 400 bytes each: a 1600-byte budget holds four.
    const cache = new LabelBitmapCache(1600);
    for (const key of ["a", "b", "c", "d"]) cache.set(key, label(10, 10));
    cache.get("a"); // "a" is now the most recent, so "b" goes first.
    cache.set("e", label(10, 10));
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBeDefined();
    expect(cache.get("e")).toBeDefined();
    expect(cache.bytes).toBe(1600);
  });

  it("replaces a key without counting it twice", () => {
    const cache = new LabelBitmapCache(1600);
    cache.set("a", label(10, 10));
    cache.set("a", label(10, 10));
    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(400);
  });

  it("keeps nothing empty, and nothing that would take over a quarter of the budget", () => {
    const cache = new LabelBitmapCache(1600);
    cache.set("empty", label(0, 10));
    cache.set("huge", label(20, 10));
    expect(cache.size).toBe(0);
  });
});
