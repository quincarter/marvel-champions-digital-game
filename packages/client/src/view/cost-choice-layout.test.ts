/**
 * The count bar's layout (`cost-choice-layout.ts`): at every phone, tablet and desktop width and for every count a
 * card prints (Power Man's 2 chi, We Are Groot's 4 growth, up to 10), no count reaches into Cancel or another count,
 * and none is narrower than a finger's 40 px (issue #856 review: four counts overlapped Cancel at 320 px).
 */
import { describe, expect, test } from "vitest";
import { MIN_COUNT_WIDTH, costCountsLayout, type BarBox } from "./cost-choice-layout.js";

const ROW = 52;
const WIDTHS = [320, 375, 390, 412, 768, 1024, 1440];
const overlap = (a: BarBox, b: BarBox): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("costCountsLayout", () => {
  for (const width of WIDTHS) {
    for (let count = 1; count <= 10; count++) {
      test(`${count} counts on a ${width} px bar stay clear of Cancel and each other`, () => {
        const layout = costCountsLayout(width, ROW, count);
        expect(layout.counts).toHaveLength(count);
        layout.counts.forEach((box, i) => {
          expect(box.width).toBeGreaterThanOrEqual(MIN_COUNT_WIDTH);
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
          expect(box.x + box.width, `count ${i + 1} ends before Cancel`).toBeLessThanOrEqual(layout.cancel.x);
          expect(overlap(box, layout.cancel)).toBe(false);
          layout.counts.slice(i + 1).forEach((other) => expect(overlap(box, other)).toBe(false));
        });
        // The question never sits under a count either.
        layout.counts.forEach((box) => expect(overlap(box, layout.question)).toBe(false));
      });
    }
  }

  test("Power Man's 2 counts sit beside the question on a phone, one bar tall", () => {
    const layout = costCountsLayout(390, ROW, 2);
    expect(layout.question.stacked).toBe(false);
    expect(layout.height).toBe(ROW);
  });

  test("We Are Groot's 4 counts on a 320 px phone put the question on its own line, at the bar's full width", () => {
    const layout = costCountsLayout(320, ROW, 4);
    expect(layout.question.stacked).toBe(true);
    expect(layout.question.width).toBe(320 - 24);
    expect(layout.height).toBeGreaterThan(ROW);
  });

  test("We Are Groot's 4 counts stay on one row beside the question on 375, 390 and 412 px phones", () => {
    for (const width of [375, 390, 412]) {
      const layout = costCountsLayout(width, ROW, 4);
      expect(layout.question.stacked, `${width} px`).toBe(false);
      expect(layout.height).toBe(ROW);
    }
  });

  test("ten counts on a phone wrap onto more rows rather than shrinking", () => {
    const layout = costCountsLayout(375, ROW, 10);
    const rows = new Set(layout.counts.map((box) => box.y)).size;
    expect(rows).toBeGreaterThan(1);
  });

  test("a desktop bar keeps everything on one row", () => {
    const layout = costCountsLayout(1440, ROW, 10);
    expect(layout.question.stacked).toBe(false);
    expect(layout.height).toBe(ROW);
  });
});
