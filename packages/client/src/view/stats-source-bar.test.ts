import { describe, expect, test } from "vitest";
import { sourceBarOf } from "./stats-source-bar.js";

const measure = (text: string) => text.length * 9;
const phone = (width: number) => ({ width, phone: true, topBar: 52 });

describe("sourceBarOf", () => {
  test("phones from 320 to 412 keep the pair inside the bar, clear of the dark mode button, hit.target tall", () => {
    for (const width of [320, 375, 412]) {
      const bar = sourceBarOf(phone(width), 0, measure);
      const centre = width / 2;
      expect(bar.you.height).toBe(44);
      expect(bar.you.y).toBeGreaterThanOrEqual(0);
      expect(bar.you.y + bar.you.height).toBeLessThanOrEqual(52);
      expect(bar.you.x).toBeGreaterThanOrEqual(centre + 17);
      expect(bar.everyone.x + bar.everyone.width).toBeLessThanOrEqual(width - 12);
      expect(bar.you.x + bar.you.width).toBe(bar.everyone.x);
      // The title can still keep most of what is left of the pair.
      expect(bar.reserveRight).toBeLessThan(width / 2);
    }
  });

  test("a narrow phone says All; a wide enough segment says Everyone", () => {
    expect(sourceBarOf(phone(320), 0, measure).labels).toEqual(["You", "All"]);
    expect(sourceBarOf({ width: 1280, phone: false, topBar: 60 }, 0, measure).labels).toEqual(["You", "Everyone"]);
  });

  test("a desktop keeps the games played text when it fits and drops it when it would crowd the centre button", () => {
    const wide = { width: 1280, phone: false, topBar: 60 };
    const roomy = sourceBarOf(wide, 170, measure);
    expect(roomy.showRight).toBe(true);
    expect(roomy.everyone.x + roomy.everyone.width).toBeLessThanOrEqual(1280 - 22 - 170);
    const tight = sourceBarOf({ ...wide, width: 760 }, 170, measure);
    expect(tight.showRight).toBe(false);
    expect(tight.you.x).toBeGreaterThanOrEqual(760 / 2 + 19);
    expect(tight.everyone.x + tight.everyone.width).toBeLessThanOrEqual(760 - 22);
  });
});
