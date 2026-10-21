import { describe, expect, it } from "vitest";
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import {
  villainBandLayout,
  villainRailLayout,
  villainTabLayout,
  type VillainRailInput,
} from "./villain-rail-layout.js";

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

/** A 1024×768 tablet in landscape: the band runs from under the chrome to the hero row. */
const BAND: Rect = { x: 8, y: 44, width: 1008, height: 256 };

describe("villainBandLayout", () => {
  it.each([
    ["nothing open", {}],
    ["interrupt", { interruptOptions: 1 }],
    ["revealing with interrupt", { revealing: true, interruptOptions: 1 }],
    ["two options", { interruptOptions: 2 }],
  ] as const)("keeps the header, columns and controls inside the band and apart (%s)", (_name, input) => {
    const layout = villainBandLayout({ panel: BAND, revealing: false, interruptOptions: 0, ...input });
    expect(layout.kind).toBe("band");
    expect(layout.stepMode).toBe("chips");
    const regions = [layout.title, layout.skip, layout.hide, ...layout.steps, layout.body, layout.toggle, layout.log];
    for (const region of regions) expect(inside(region, BAND)).toBe(true);
    for (const [a, b] of [
      [layout.title, layout.steps[0]!],
      [layout.steps[4]!, layout.skip],
      [layout.skip, layout.hide],
      [layout.body, layout.log],
      [layout.log, layout.toggle],
    ] as const) {
      expect(overlaps(a, b)).toBe(false);
    }
    if (layout.interrupt) {
      const w = layout.interrupt;
      expect(inside(w.frame, BAND)).toBe(true);
      expect(overlaps(w.frame, layout.body)).toBe(false);
      expect(overlaps(w.frame, layout.log)).toBe(false);
      expect(w.use.height).toBeGreaterThanOrEqual(hit.primary);
      expect(inside(w.card, w.frame)).toBe(true);
      expect(overlaps(w.card, w.use)).toBe(false);
      expect(overlaps(w.text, w.use)).toBe(false);
      for (const row of w.extraRows) expect(overlaps(row, w.use)).toBe(false);
    }
  });

  it("puts the encounter cards in the right column while revealing and keeps the revealed card readable", () => {
    const layout = villainBandLayout({ panel: BAND, revealing: true, interruptOptions: 1 });
    expect(layout.encounterStrip).not.toBeNull();
    expect(overlaps(layout.encounterStrip!, layout.body)).toBe(false);
    expect(overlaps(layout.encounterStrip!, layout.interrupt!.frame)).toBe(false);
    expect(overlaps(layout.encounterStrip!, layout.toggle)).toBe(false);
    expect(layout.log.height).toBe(0);
    expect(layout.bodyArt.height).toBeGreaterThanOrEqual(150);
  });
});

/** A 390×844 phone: the panel runs from the chrome to the hand; the action bar is the footer. */
const PHONE = { panel: { x: 0, y: 40, width: 390, height: 540 }, footer: { x: 0, y: 748, width: 390, height: 96 } };
/** A 768×1024 tablet in portrait. */
const PORTRAIT = { panel: { x: 0, y: 44, width: 768, height: 676 }, footer: { x: 0, y: 930, width: 768, height: 94 } };

describe("villainTabLayout", () => {
  it.each([
    ["phone", PHONE, {}],
    ["phone, interrupt", PHONE, { interruptOptions: 1 }],
    ["phone, revealing with interrupt", PHONE, { revealing: true, interruptOptions: 1 }],
    ["phone, two options", PHONE, { interruptOptions: 2 }],
    ["portrait, revealing", PORTRAIT, { revealing: true }],
  ] as const)("keeps the panel's regions inside it and the answer in the action bar's place (%s)", (_n, at, input) => {
    const layout = villainTabLayout({ ...at, revealing: false, interruptOptions: 0, ...input });
    expect(layout.kind).toBe("tab");
    expect(layout.toggle.width).toBe(0);
    for (const region of [layout.title, layout.skip, layout.hide, ...layout.steps, layout.body, layout.log]) {
      expect(inside(region, at.panel)).toBe(true);
    }
    expect(overlaps(layout.hide, layout.skip)).toBe(false);
    expect(overlaps(layout.title, layout.hide)).toBe(false);
    expect(layout.hide.height).toBeGreaterThanOrEqual(hit.target);
    if (layout.interrupt) {
      const w = layout.interrupt;
      expect(inside(w.frame, at.panel)).toBe(true);
      expect(overlaps(w.frame, layout.body)).toBe(false);
      expect(inside(w.use, at.footer)).toBe(true);
      expect(inside(w.resolve, at.footer)).toBe(true);
      expect(overlaps(w.use, w.resolve)).toBe(false);
      expect(inside(w.card, w.frame)).toBe(true);
      for (const row of w.extraRows) expect(inside(row, w.frame)).toBe(true);
    }
  });

  it("grows happening now on a phone out of the log's room, so a wrapped headline, the breakdown and a boost card fit (#285)", () => {
    const layout = villainTabLayout({ ...PHONE, revealing: false, interruptOptions: 0 });
    expect(layout.bodyText.height).toBeGreaterThanOrEqual(220);
    expect(layout.log.height).toBeGreaterThanOrEqual(60);
    // With the interrupt window open the log has less to give, and the body never takes the window's place.
    const open = villainTabLayout({ ...PHONE, revealing: false, interruptOptions: 1 });
    expect(open.body.height).toBeGreaterThanOrEqual(180);
    expect(overlaps(open.body, open.interrupt!.frame)).toBe(false);
  });

  it("gives the revealed card most of the body on a phone (#128)", () => {
    const layout = villainTabLayout({ ...PHONE, revealing: true, interruptOptions: 0 });
    expect(layout.bodyArt.width).toBeGreaterThanOrEqual(150);
  });
});

describe("card size (the global Card size setting)", () => {
  const scales = [1, 1.25, 1.5] as const;
  it.each(scales)("keeps every docked shape whole at %s×: inside the panel, body and interrupt apart", (cardScale) => {
    const shapes = [
      villainRailLayout({ panel: SHORT, revealing: true, interruptOptions: 1, cardScale }),
      villainRailLayout({ panel: TALL, revealing: false, interruptOptions: 2, cardScale }),
      villainBandLayout({ panel: BAND, revealing: true, interruptOptions: 1, cardScale }),
      villainTabLayout({ ...PHONE, revealing: true, interruptOptions: 1, cardScale }),
      villainTabLayout({ ...PORTRAIT, revealing: false, interruptOptions: 1, cardScale }),
    ];
    for (const layout of shapes) {
      expect(inside(layout.body, layout.panel)).toBe(true);
      expect(inside(layout.bodyArt, layout.body)).toBe(true);
      expect(layout.bodyText.width).toBeGreaterThan(0);
      if (layout.interrupt) {
        expect(inside(layout.interrupt.frame, layout.panel)).toBe(true);
        expect(inside(layout.interrupt.card, layout.interrupt.frame)).toBe(true);
        expect(overlaps(layout.interrupt.frame, layout.body)).toBe(false);
        expect(layout.interrupt.text.width).toBeGreaterThan(0);
        if (layout.kind === "rail") {
          expect(layout.interrupt.frame.y + layout.interrupt.frame.height).toBeLessThanOrEqual(layout.footer.y + 0.5);
        }
      }
      if (layout.log.height > 0) expect(inside(layout.log, layout.panel)).toBe(true);
    }
  });

  it("draws the revealed card and the enemy larger where the panel has room", () => {
    const at = (cardScale: number) =>
      villainRailLayout({ panel: TALL, revealing: true, interruptOptions: 0, cardScale });
    expect(at(1.5).bodyArt.width).toBeGreaterThan(at(1).bodyArt.width);
    const happening = (cardScale: number) =>
      villainRailLayout({ panel: TALL, revealing: false, interruptOptions: 0, cardScale });
    expect(happening(1.5).bodyArt.width).toBeGreaterThan(happening(1).bodyArt.width);
  });
});
