import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./title-layout.js";
import { pauseLayout } from "./pause-layout.js";

const SIZES = [
  { name: "phone", width: 440, height: 900 },
  { name: "small desktop", width: 800, height: 600 },
  { name: "desktop", width: 1440, height: 980 },
];

describe("pauseLayout", () => {
  for (const { name, width, height } of SIZES) {
    test(`no two rows overlap at ${name} (${width}x${height})`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height });
      const rects = [layout.header, layout.resume, layout.saveQuit, layout.rulesButton, layout.settingsButton, layout.momentsHeading, layout.footer];
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
        }
      }
      // The moments viewport sits below its own heading and never overlaps the footer.
      expect(rectsOverlap(layout.moments, layout.momentsHeading)).toBe(false);
      expect(rectsOverlap(layout.moments, layout.footer)).toBe(false);
    });

    test(`every row stays inside the panel at ${name}`, () => {
      const layout = pauseLayout({ x: 0, y: 0, width, height });
      for (const rect of [layout.header, layout.resume, layout.saveQuit, layout.rulesButton, layout.settingsButton, layout.footer]) {
        expect(rect.x).toBeGreaterThanOrEqual(layout.panel.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(layout.panel.x + layout.panel.width + 0.001);
        expect(rect.y + rect.height).toBeLessThanOrEqual(layout.panel.y + layout.panel.height + 0.001);
      }
    });
  }
});
