import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./title-layout.js";
import { overlayPanelLayout, stackedRow } from "./overlay-layout.js";

const SIZES = [
  { name: "phone", width: 440, height: 900 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "desktop", width: 1440, height: 980 },
];

describe("overlayPanelLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`the panel stays within the screen at ${name} (${width}x${height})`, () => {
      const { panel } = overlayPanelLayout({ x: 0, y: 0, width, height }, 80, 120);
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(height);
    });

    test(`header, body and footer never overlap at ${name}`, () => {
      const { header, body, footer } = overlayPanelLayout({ x: 0, y: 0, width, height }, 80, 120);
      expect(rectsOverlap(header, body)).toBe(false);
      expect(rectsOverlap(body, footer)).toBe(false);
      expect(rectsOverlap(header, footer)).toBe(false);
    });
  }

  test("the body never goes negative even with generous header/footer bands on a short screen", () => {
    const { body } = overlayPanelLayout({ x: 0, y: 0, width: 440, height: 300 }, 200, 200);
    expect(body.height).toBeGreaterThanOrEqual(0);
    expect(body.width).toBeGreaterThan(0);
  });
});

describe("stackedRow", () => {
  test("consecutive rows never overlap", () => {
    const body = { x: 0, y: 0, width: 400, height: 500 };
    const rows = [0, 1, 2, 3].map((i) => stackedRow(body, i));
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        expect(rectsOverlap(rows[i]!, rows[j]!)).toBe(false);
      }
    }
  });
});
