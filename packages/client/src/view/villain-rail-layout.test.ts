import { describe, expect, it } from "vitest";
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { villainRailLayout, type VillainRailInput } from "./villain-rail-layout.js";

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.width > 0 &&
  a.height > 0 &&
  b.width > 0 &&
  b.height > 0 &&
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/** A 1440×900 desktop: the rail is 475 wide under a 64px chrome band. */
const SHORT: Rect = { x: 965, y: 64, width: 475, height: 836 };
/** A 1920×1200 desktop. */
const TALL: Rect = { x: 1320, y: 64, width: 600, height: 1136 };

const layoutOf = (panel: Rect, input: Partial<VillainRailInput> = {}) =>
  villainRailLayout({ panel, revealing: false, interruptOptions: 0, ...input });

describe("villainRailLayout", () => {
  it.each([
    ["short, nothing open", SHORT, {}],
    ["short, interrupt", SHORT, { interruptOptions: 1 }],
    ["short, revealing with interrupt", SHORT, { revealing: true, interruptOptions: 1 }],
    ["short, three options", SHORT, { interruptOptions: 3 }],
    ["tall, revealing", TALL, { revealing: true }],
    ["tall, interrupt", TALL, { interruptOptions: 1 }],
  ] as const)("keeps every region inside the panel and apart (%s)", (_name, panel, input) => {
    const layout = layoutOf(panel, input);
    const regions: Rect[] = [
      layout.title,
      layout.skip,
      layout.hide,
      layout.subtitle,
      ...layout.steps,
      ...(layout.encounterLabel ? [layout.encounterLabel] : []),
      ...(layout.encounterStrip ? [layout.encounterStrip] : []),
      layout.body,
      ...(layout.interrupt ? [layout.interrupt.frame] : []),
      layout.log,
      layout.footer,
    ];
    for (const region of regions) expect(inside(region, panel)).toBe(true);
    const stacked = [layout.body, layout.interrupt?.frame, layout.log, layout.footer].filter(
      (r): r is Rect => r !== undefined,
    );
    for (let i = 0; i < stacked.length; i++) {
      for (let j = i + 1; j < stacked.length; j++) expect(overlaps(stacked[i]!, stacked[j]!)).toBe(false);
    }
    expect(overlaps(layout.skip, layout.hide)).toBe(false);
    expect(overlaps(layout.title, layout.skip)).toBe(false);
  });

  it("lists the steps vertically on a tall rail (D1) and as chips while revealing (D2)", () => {
    expect(layoutOf(TALL, { interruptOptions: 1 }).stepMode).toBe("list");
    expect(layoutOf(TALL, { revealing: true }).stepMode).toBe("chips");
    expect(layoutOf(TALL, { revealing: true }).encounterStrip).not.toBeNull();
    expect(layoutOf(TALL).encounterStrip).toBeNull();
  });

  it("falls back to chips when the list would squeeze the body on a 900px desktop with an interrupt open", () => {
    const layout = layoutOf(SHORT, { interruptOptions: 1 });
    expect(layout.stepMode).toBe("chips");
    expect(layout.body.height).toBeGreaterThanOrEqual(150);
  });

  it("keeps the revealed card readable on a 900px desktop even with an interrupt open (#128)", () => {
    const layout = layoutOf(SHORT, { revealing: true, interruptOptions: 1 });
    expect(layout.bodyArt.width).toBeGreaterThanOrEqual(160);
    expect(layout.bodyArt.height).toBeLessThanOrEqual(layout.body.height + 0.5);
    expect(layout.bodyText.width).toBeGreaterThanOrEqual(200);
  });

  it("gives the interrupt buttons a primary hit target and keeps the card inside the window", () => {
    for (const panel of [SHORT, TALL]) {
      const interrupt = layoutOf(panel, { interruptOptions: 2 }).interrupt!;
      expect(interrupt.use.height).toBeGreaterThanOrEqual(hit.primary);
      expect(interrupt.resolve.height).toBeGreaterThanOrEqual(hit.primary);
      expect(overlaps(interrupt.use, interrupt.resolve)).toBe(false);
      expect(inside(interrupt.card, interrupt.frame)).toBe(true);
      expect(interrupt.extraRows).toHaveLength(1);
      expect(overlaps(interrupt.extraRows[0]!, interrupt.use)).toBe(false);
    }
  });

  it("drops the log rather than squeezing it under its floor", () => {
    const layout = layoutOf(SHORT, { revealing: true, interruptOptions: 1 });
    expect(layout.log.height === 0 || layout.log.height >= 60).toBe(true);
    expect(layoutOf(TALL).log.height).toBeGreaterThanOrEqual(60);
  });
});
