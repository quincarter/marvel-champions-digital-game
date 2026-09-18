import { describe, expect, test } from "vitest";
import { coverFit, pickTitleArt, type TitleArt } from "./title-art.js";

const pool: readonly TitleArt[] = [
  { key: "title-art:a.png", url: "/a.png" },
  { key: "title-art:b.jpg", url: "/b.jpg" },
  { key: "title-art:c.webp", url: "/c.webp" },
];

describe("pickTitleArt", () => {
  test("nothing to show when the folder is empty", () => {
    expect(pickTitleArt([], null, () => 0.5)).toBeNull();
  });

  test("picks by the random draw", () => {
    expect(pickTitleArt(pool, null, () => 0)).toEqual(pool[0]);
    expect(pickTitleArt(pool, null, () => 0.99)).toEqual(pool[2]);
    // A draw of exactly 1 (some RNGs can return it) still lands on a real entry.
    expect(pickTitleArt(pool, null, () => 1)).toEqual(pool[2]);
  });

  test("never repeats the picture shown last time when there is a choice", () => {
    for (const draw of [0, 0.3, 0.6, 0.99]) {
      expect(pickTitleArt(pool, "title-art:b.jpg", () => draw)?.key).not.toBe("title-art:b.jpg");
    }
  });

  test("a single picture is shown again rather than nothing", () => {
    expect(pickTitleArt([pool[0]!], pool[0]!.key, () => 0.5)).toEqual(pool[0]);
  });
});

describe("coverFit", () => {
  test("a wide picture in a tall panel scales to the panel's height and crops the sides", () => {
    const fit = coverFit({ width: 2000, height: 1000 }, { width: 500, height: 1000 });
    expect(fit.scale).toBe(1);
    expect(fit.cropWidth).toBe(500);
    expect(fit.cropHeight).toBe(1000);
    expect(fit.cropX).toBe(750);
    expect(fit.cropY).toBe(0);
  });

  test("a small picture is scaled up to cover, never letterboxed", () => {
    const fit = coverFit({ width: 400, height: 300 }, { width: 800, height: 800 });
    expect(fit.scale).toBeCloseTo(800 / 300);
    expect(fit.cropWidth * fit.scale).toBeCloseTo(800);
    expect(fit.cropHeight * fit.scale).toBeCloseTo(800);
  });
});
