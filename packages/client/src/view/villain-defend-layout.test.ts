import { describe, expect, it } from "vitest";
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { villainDefendLayout, villainDefendOptionParts, type DefendDockKind } from "./villain-defend-layout.js";

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
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

interface Case {
  readonly name: string;
  readonly kind: DefendDockKind;
  readonly panel: Rect;
  readonly footer?: Rect;
}

/** The wide rail at three viewports: 600 (a small laptop), 760 (1440 wide at the design's width) and 1100 (the cap). */
const CASES: readonly Case[] = [
  { name: "rail 600", kind: "rail", panel: { x: 680, y: 64, width: 600, height: 736 } },
  { name: "rail 760", kind: "rail", panel: { x: 680, y: 64, width: 760, height: 836 } },
  { name: "rail 1100", kind: "rail", panel: { x: 1460, y: 64, width: 1100, height: 1376 } },
  { name: "band tall 1024x768", kind: "band", panel: { x: 8, y: 64, width: 1008, height: 470 } },
  {
    name: "tab 768x1024",
    kind: "tab",
    panel: { x: 0, y: 150, width: 768, height: 560 },
    footer: { x: 0, y: 940, width: 768, height: 76 },
  },
  {
    name: "tab phone 390x844",
    kind: "tab",
    panel: { x: 0, y: 110, width: 390, height: 520 },
    footer: { x: 0, y: 770, width: 390, height: 66 },
  },
];

describe("villainDefendLayout", () => {
  describe.each(CASES)("$name", ({ kind, panel, footer }) => {
    for (const count of [2, 3, 4]) {
      it(`keeps every part inside the panel with ${count} options, nothing overlapping`, () => {
        const layout = villainDefendLayout({ panel, kind, optionCount: count, footer: footer ?? null });
        expect(layout.options).toHaveLength(count);
        // Past what a layout holds the scene hands the choice to the sheet; every shape holds two and three.
        if (count <= 3) expect(layout.fits).toBe(true);
        if (!layout.fits) return;
        for (const option of layout.options) expect(inside(option, panel)).toBe(true);
        for (const rect of [layout.eyebrow, layout.title, layout.expand, layout.matchup, layout.optionsLabel]) {
          expect(inside(rect, panel)).toBe(true);
        }
        if (layout.confirmInFooter) expect(inside(layout.confirm, footer!)).toBe(true);
        else expect(inside(layout.confirm, panel)).toBe(true);
        expect(inside(layout.stack, panel)).toBe(true);

        const parts: Rect[] = [
          layout.eyebrow,
          layout.title,
          layout.expand,
          layout.matchup,
          layout.optionsLabel,
          ...layout.options,
          layout.stack,
          ...(layout.confirmInFooter ? [] : [layout.confirm]),
        ];
        parts.forEach((a, i) =>
          parts.slice(i + 1).forEach((b, j) => {
            // The eyebrow and the title share the header column on purpose; they are stacked, not overlapping.
            expect(overlaps(a, b), `part ${i} vs part ${i + 1 + j}`).toBe(false);
          }),
        );
      });
    }

    it("has hit targets of at least 44 for EXPAND, CONFIRM and every option", () => {
      const layout = villainDefendLayout({ panel, kind, optionCount: 3, footer: footer ?? null });
      expect(layout.expand.height).toBeGreaterThanOrEqual(hit.target);
      expect(layout.expand.width).toBeGreaterThanOrEqual(hit.target);
      expect(layout.confirm.height).toBeGreaterThanOrEqual(hit.target);
      for (const option of layout.options) {
        expect(option.height).toBeGreaterThanOrEqual(hit.target);
        expect(option.width).toBeGreaterThanOrEqual(hit.target);
      }
    });

    it("gives the options' picture and text non-overlapping rects inside the cell", () => {
      const layout = villainDefendLayout({ panel, kind, optionCount: 3, footer: footer ?? null });
      for (const slot of layout.options) {
        const parts = villainDefendOptionParts(slot, layout.orientation);
        expect(inside(parts.text, slot)).toBe(true);
        expect(parts.text.height).toBeGreaterThan(60);
        if (parts.picture) {
          expect(inside(parts.picture, slot)).toBe(true);
          expect(overlaps(parts.picture, parts.text)).toBe(false);
        }
      }
    });
  });

  it("reflows three options across a wide rail and into rows on a narrow one", () => {
    const wide = villainDefendLayout({ panel: { x: 0, y: 0, width: 1100, height: 900 }, kind: "rail", optionCount: 3 });
    expect(new Set(wide.options.map((o) => o.y)).size).toBe(1);
    expect(wide.orientation).toBe("top");
    const phone = villainDefendLayout({ panel: { x: 0, y: 0, width: 366, height: 700 }, kind: "tab", optionCount: 3 });
    expect(new Set(phone.options.map((o) => o.x)).size).toBe(1);
    expect(phone.orientation).toBe("left");
  });

  it("docks a defend with four or five defenders on a phone, in the dense shape, instead of handing it to the sheet", () => {
    const phone = CASES.find((c) => c.name === "tab phone 390x844")!;
    for (const count of [4, 5]) {
      const layout = villainDefendLayout({
        panel: phone.panel,
        kind: "tab",
        optionCount: count,
        footer: phone.footer ?? null,
      });
      expect(layout.fits).toBe(true);
      expect(layout.dense).toBe(true);
      expect(layout.options).toHaveLength(count);
      for (const option of layout.options) expect(inside(option, phone.panel)).toBe(true);
      for (let i = 1; i < count; i++) {
        const prev = layout.options[i - 1]!;
        expect(layout.options[i]!.y).toBeGreaterThanOrEqual(prev.y + prev.height);
      }
    }
  });

  it("keeps the ordinary shapes undense when they fit", () => {
    const rail = villainDefendLayout({ panel: { x: 0, y: 0, width: 760, height: 836 }, kind: "rail", optionCount: 3 });
    expect(rail.dense).toBe(false);
  });

  it("draws the picture beside the text on the band and over it on the rail", () => {
    const band = villainDefendLayout({ panel: { x: 0, y: 0, width: 1008, height: 470 }, kind: "band", optionCount: 3 });
    expect(band.orientation).toBe("left");
    const parts = villainDefendOptionParts(band.options[0]!, band.orientation);
    expect(parts.picture!.x + parts.picture!.width).toBeLessThanOrEqual(parts.text.x);
    const rail = villainDefendLayout({ panel: { x: 0, y: 0, width: 760, height: 836 }, kind: "rail", optionCount: 3 });
    const railParts = villainDefendOptionParts(rail.options[0]!, rail.orientation);
    expect(railParts.picture!.y + railParts.picture!.height).toBeLessThanOrEqual(railParts.text.y);
  });
});

describe("villainDefendLayout: HIDE or PEEK AT TABLE (#231)", () => {
  for (const c of CASES) {
    it(`${c.name}: the tuck control is full size and clear of EXPAND, CONFIRM and the title`, () => {
      const layout = villainDefendLayout({ panel: c.panel, kind: c.kind, optionCount: 2, footer: c.footer ?? null });
      expect(layout.tuck.height).toBeGreaterThanOrEqual(hit.target);
      for (const other of [layout.expand, layout.confirm, layout.title, layout.eyebrow])
        expect(overlaps(layout.tuck, other)).toBe(false);
      if (layout.confirmInFooter && c.footer)
        expect(inside(layout.tuck, c.footer), "beside CONFIRM at the thumb").toBe(true);
      else expect(inside(layout.tuck, c.panel)).toBe(true);
    });
  }
});
