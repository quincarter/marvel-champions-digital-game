import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./title-layout.js";
import { defendChoiceLayout, defendOptionSlots, type DefendChoiceLayout } from "./defend-choice-layout.js";
import { REFERENCE_VIEWPORTS, type Rect } from "./layout.js";

/** docs/phase4-screen-gaps.md §0: checked at portrait phone, tablet portrait, tablet landscape and desktop. */
const VIEWPORTS = [
  { name: "phone 390×844", ...REFERENCE_VIEWPORTS.phone },
  { name: "tablet portrait 768×1024", ...REFERENCE_VIEWPORTS.tabletPortrait },
  { name: "tablet landscape 1024×768", ...REFERENCE_VIEWPORTS.tabletLandscape },
  { name: "desktop 1440×900", ...REFERENCE_VIEWPORTS.desktop },
];

function sectionRects(layout: DefendChoiceLayout): readonly Rect[] {
  return [layout.header, layout.summary, layout.options, layout.stack, layout.waitingOn, layout.commit];
}

describe("defendChoiceLayout", () => {
  for (const { name, width, height } of VIEWPORTS) {
    describe(name, () => {
      test("no two sections overlap", () => {
        const layout = defendChoiceLayout({ x: 0, y: 0, width, height });
        const rects = sectionRects(layout);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
          }
        }
      });

      test("every section stays inside the sheet, and the sheet stays inside the viewport", () => {
        const layout = defendChoiceLayout({ x: 0, y: 0, width, height });
        expect(layout.sheet.x).toBeGreaterThanOrEqual(0);
        expect(layout.sheet.y).toBeGreaterThanOrEqual(0);
        expect(layout.sheet.x + layout.sheet.width).toBeLessThanOrEqual(width + 0.001);
        expect(layout.sheet.y + layout.sheet.height).toBeLessThanOrEqual(height + 0.001);
        for (const rect of sectionRects(layout)) {
          expect(rect.x).toBeGreaterThanOrEqual(layout.sheet.x - 0.001);
          expect(rect.y).toBeGreaterThanOrEqual(layout.sheet.y - 0.001);
          expect(rect.x + rect.width).toBeLessThanOrEqual(layout.sheet.x + layout.sheet.width + 0.001);
          expect(rect.y + rect.height).toBeLessThanOrEqual(layout.sheet.y + layout.sheet.height + 0.001);
          expect(rect.width).toBeGreaterThanOrEqual(0);
          expect(rect.height).toBeGreaterThanOrEqual(0);
        }
      });

      test("the board stays legible around the sheet — it never claims the entire viewport (tablet L02's rule)", () => {
        const layout = defendChoiceLayout({ x: 0, y: 0, width, height });
        expect(layout.sheet.width).toBeLessThan(width);
        expect(layout.sheet.height).toBeLessThan(height);
      });

      test("wide layouts (tablet landscape, desktop) put Confirm in the stack's own rail, not the full sheet width", () => {
        const layout = defendChoiceLayout({ x: 0, y: 0, width, height });
        if (layout.formFactor === "desktop" || layout.formFactor === "tabletLandscape") {
          expect(layout.commit.width).toBeCloseTo(layout.stack.width, 0);
          expect(layout.commit.x).toBeCloseTo(layout.stack.x, 0);
        } else {
          expect(layout.commit.width).toBeCloseTo(layout.sheet.width, 0);
        }
      });
    });
  }
});

describe("defendOptionSlots", () => {
  const area: Rect = { x: 10, y: 10, width: 600, height: 300 };

  test("empty for zero options", () => {
    expect(defendOptionSlots(area, 0, "desktop")).toEqual([]);
  });

  for (const formFactor of ["phone", "tabletPortrait", "tabletLandscape", "desktop"] as const) {
    for (const count of [1, 2, 3, 4, 5, 6]) {
      test(`${formFactor} × ${count} options: no overlap, all inside area`, () => {
        const slots = defendOptionSlots(area, count, formFactor);
        expect(slots).toHaveLength(count);
        for (const slot of slots) {
          expect(slot.width).toBeGreaterThan(0);
          expect(slot.height).toBeGreaterThan(0);
          expect(slot.x).toBeGreaterThanOrEqual(area.x - 0.001);
          expect(slot.y).toBeGreaterThanOrEqual(area.y - 0.001);
          expect(slot.x + slot.width).toBeLessThanOrEqual(area.x + area.width + 0.001);
          expect(slot.y + slot.height).toBeLessThanOrEqual(area.y + area.height + 0.001);
        }
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            expect(rectsOverlap(slots[i]!, slots[j]!), `slot ${i} overlaps slot ${j}`).toBe(false);
          }
        }
      });
    }
  }

  test("phone stacks rows full-width; desktop/tablet-landscape place cards side by side when they fit", () => {
    const twoPhone = defendOptionSlots(area, 2, "phone");
    expect(twoPhone[0]!.width).toBeCloseTo(area.width, 0);
    expect(twoPhone[1]!.y).toBeGreaterThan(twoPhone[0]!.y);

    const twoDesktop = defendOptionSlots(area, 2, "desktop");
    expect(twoDesktop[0]!.y).toBeCloseTo(twoDesktop[1]!.y, 0);
    expect(twoDesktop[1]!.x).toBeGreaterThan(twoDesktop[0]!.x);
  });
});
