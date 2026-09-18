import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./title-layout.js";
import { deckCheckLayout, deckCheckLayoutRects } from "./deck-check-layout.js";

/** docs/phase4-screen-gaps.md §0/§5: phone, tablet portrait/landscape and desktop, plus the legacy sizes this layout was already checked at. */
const VIEWPORTS = [
  { name: "375×812", width: 375, height: 812 },
  { name: "phone (390×844)", width: 390, height: 844 },
  { name: "portrait phone (legacy)", width: 440, height: 900 },
  { name: "800×600", width: 800, height: 600 },
  { name: "tablet portrait (768×1024)", width: 768, height: 1024 },
  { name: "tablet landscape (1024×768)", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

describe("deckCheckLayout", () => {
  for (const { name, width, height } of VIEWPORTS) {
    describe(name, () => {
      test("no two rects overlap", () => {
        const layout = deckCheckLayout({ width, height });
        const rects = deckCheckLayoutRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
          }
        }
      });

      test("Edit deck and Start game sit inside the footer and never overlap each other", () => {
        const layout = deckCheckLayout({ width, height });
        expect(rectsOverlap(layout.editDeck, layout.startGame)).toBe(false);
        for (const button of [layout.editDeck, layout.startGame]) {
          expect(button.y).toBeGreaterThanOrEqual(layout.footer.y);
          expect(button.y + button.height).toBeLessThanOrEqual(layout.footer.y + layout.footer.height);
          expect(button.x).toBeGreaterThanOrEqual(layout.footer.x);
          expect(button.x + button.width).toBeLessThanOrEqual(layout.footer.x + layout.footer.width);
        }
      });

      test("the content area never overlaps the tabs above it or the footer below it, and is never negative", () => {
        const layout = deckCheckLayout({ width, height });
        expect(rectsOverlap(layout.content, layout.tabs)).toBe(false);
        expect(rectsOverlap(layout.content, layout.footer)).toBe(false);
        expect(layout.content.height).toBeGreaterThanOrEqual(0);
      });

      test("every rect stays within the screen bounds", () => {
        const layout = deckCheckLayout({ width, height });
        for (const rect of deckCheckLayoutRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
        }
      });
    });
  }
});
