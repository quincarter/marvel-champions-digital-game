import { describe, expect, test } from "vitest";
import type { FormFactor, Rect } from "./layout.js";
import { formFactorFor, rectsOverlap } from "./layout.js";
import { villainPhaseLayout, type VillainPhaseLayout } from "./villain-phase-layout.js";

/** docs/phase4-screen-gaps.md §3 "W7": checked at phone, both tablet orientations and desktop. */
const VIEWPORTS = [
  { name: "phone 390×844", width: 390, height: 844 },
  { name: "tablet portrait 768×1024", width: 768, height: 1024 },
  { name: "tablet landscape 1024×768", width: 1024, height: 768 },
  { name: "desktop 1440×900", width: 1440, height: 900 },
];

/** Every region a player can actually look at — `panel` deliberately contains all of them, so it's excluded. */
function leafRects(layout: VillainPhaseLayout): readonly Rect[] {
  return [
    layout.title,
    layout.skip,
    layout.subtitle,
    layout.stepStrip,
    layout.stepLine,
    layout.happeningNow,
    layout.boosts,
    layout.teamStatus,
    layout.mainScheme,
    layout.queued,
    layout.phaseLog,
    layout.footer,
  ];
}

describe("villainPhaseLayout", () => {
  for (const { name, width, height } of VIEWPORTS) {
    const formFactor: FormFactor = formFactorFor(width, height);
    const phone = formFactor === "phone";
    const tablet = formFactor === "tabletLandscape" || formFactor === "tabletPortrait";
    const bounds: Rect = { x: 0, y: 0, width, height };

    describe(name, () => {
      test("no two regions overlap", () => {
        const rects = leafRects(villainPhaseLayout(bounds, formFactor));
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
          }
        }
      });

      test("every region stays within the viewport", () => {
        for (const rect of leafRects(villainPhaseLayout(bounds, formFactor))) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
          expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.001);
          expect(rect.width).toBeGreaterThanOrEqual(0);
          expect(rect.height).toBeGreaterThanOrEqual(0);
        }
      });

      test("exactly one of the step strip and the compact step line is drawn", () => {
        const layout = villainPhaseLayout(bounds, formFactor);
        expect(layout.stepStrip.height > 0).toBe(!phone);
        expect(layout.stepLine.height > 0).toBe(phone);
      });

      test("title and Skip sit side by side in the header row, never stacked", () => {
        const layout = villainPhaseLayout(bounds, formFactor);
        expect(layout.skip.x).toBeGreaterThanOrEqual(layout.title.x + layout.title.width);
      });

      if (!phone) {
        test("the rail sits to the right of the main column", () => {
          const layout = villainPhaseLayout(bounds, formFactor);
          expect(layout.mainScheme.x).toBeGreaterThan(layout.happeningNow.x + layout.happeningNow.width);
        });

        if (tablet) {
          test("tablet (L02): team status sits above the main-scheme callout, and the phase log is dropped", () => {
            const layout = villainPhaseLayout(bounds, formFactor);
            expect(layout.teamStatus.x).toBe(layout.mainScheme.x);
            expect(layout.teamStatus.y + layout.teamStatus.height).toBeLessThanOrEqual(layout.mainScheme.y);
            // The team rail stays legible, not a sliver, behind the walkthrough.
            expect(layout.teamStatus.height).toBeGreaterThan(40);
            expect(layout.phaseLog.height).toBe(0);
          });
        } else {
          test("desktop (D11): the main scheme callout and the phase log form the rail; no team status", () => {
            const layout = villainPhaseLayout(bounds, formFactor);
            expect(layout.mainScheme.x).toBe(layout.phaseLog.x);
            expect(layout.mainScheme.y + layout.mainScheme.height).toBeLessThanOrEqual(layout.phaseLog.y);
            // The rail's own two panels stay legible: the log gets real room, not a sliver.
            expect(layout.phaseLog.height).toBeGreaterThan(40);
            expect(layout.teamStatus.height).toBe(0);
          });
        }

        test("happening now, the boost row and queued this phase stack in the main column, top to bottom", () => {
          // With a boost card actually revealed: an empty boosts rect (the
          // default, zero-height) legitimately shares its y with queued right
          // under it, which the dedicated boosts-height tests already cover.
          const layout = villainPhaseLayout(bounds, formFactor, 1);
          expect(layout.happeningNow.y).toBeLessThan(layout.boosts.y);
          expect(layout.boosts.y).toBeLessThan(layout.queued.y);
          expect(layout.happeningNow.x).toBe(layout.boosts.x);
          expect(layout.boosts.x).toBe(layout.queued.x);
        });
      } else {
        test("phone stacks every section in one column, in reading order", () => {
          const layout = villainPhaseLayout(bounds, formFactor);
          const order = [layout.stepLine, layout.happeningNow, layout.boosts, layout.mainScheme, layout.queued, layout.phaseLog];
          for (let i = 1; i < order.length; i++) {
            expect(order[i]!.y).toBeGreaterThanOrEqual(order[i - 1]!.y + order[i - 1]!.height);
          }
        });

        test("phone has no team status panel — it is already one seat's own view", () => {
          expect(villainPhaseLayout(bounds, formFactor).teamStatus.height).toBe(0);
        });
      }

      test("the footer sits at the very bottom, above nothing else", () => {
        const layout = villainPhaseLayout(bounds, formFactor);
        expect(layout.footer.y + layout.footer.height).toBeLessThanOrEqual(layout.panel.y + layout.panel.height + 0.001);
        expect(layout.queued.y + layout.queued.height).toBeLessThanOrEqual(layout.footer.y + 0.001);
        expect(layout.phaseLog.y + layout.phaseLog.height).toBeLessThanOrEqual(layout.footer.y + 0.001);
      });

      test("boosts is zero height with nothing revealed, and stays that way with the default argument", () => {
        expect(villainPhaseLayout(bounds, formFactor).boosts.height).toBe(0);
        expect(villainPhaseLayout(bounds, formFactor, 0).boosts.height).toBe(0);
      });

      test("boosts grows tall enough for a real scan once a boost card is revealed, still with no overlap", () => {
        const withBoosts = villainPhaseLayout(bounds, formFactor, 1);
        expect(withBoosts.boosts.height).toBeGreaterThanOrEqual(phone ? 120 : 220);
        expect(withBoosts.boosts.height).toBeLessThanOrEqual(phone ? 200 : 260);
        const rects = leafRects(withBoosts);
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(rectsOverlap(rects[i]!, rects[j]!), `rect ${i} overlaps rect ${j}`).toBe(false);
          }
        }
        for (const rect of rects) {
          expect(rect.x + rect.width).toBeLessThanOrEqual(width + 0.001);
          expect(rect.y + rect.height).toBeLessThanOrEqual(height + 0.001);
        }
      });

      test("more revealed boost cards never shrink the reserved boosts height (a fixed panel, tiled by the boosts sub-layout)", () => {
        const one = villainPhaseLayout(bounds, formFactor, 1);
        const many = villainPhaseLayout(bounds, formFactor, 4);
        expect(many.boosts.height).toBe(one.boosts.height);
        expect(many.boosts.width).toBe(one.boosts.width);
      });
    });
  }
});
