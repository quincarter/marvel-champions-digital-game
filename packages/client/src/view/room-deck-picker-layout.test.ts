import { describe, expect, it } from "vitest";
import {
  DEFAULT_PICKER_VIEW,
  PICKER_VIEW_KEY,
  detailsPanelRect,
  detailsPresentationOf,
  gridContentHeight,
  panelOffsetAt,
  pickerControlsLayout,
  pickerGridLayout,
  readPickerView,
  tileRect,
  tileTitleOf,
  writePickerView,
} from "./room-deck-picker-layout.js";
import type { Rect } from "./layout.js";

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe("picker view preference", () => {
  it("defaults to the grid", () => {
    expect(DEFAULT_PICKER_VIEW).toBe("grid");
    expect(readPickerView(memory())).toBe("grid");
    expect(readPickerView(null)).toBe("grid");
  });
  it("remembers the list, and ignores anything it does not know", () => {
    const storage = memory();
    writePickerView("list", storage);
    expect(storage.getItem(PICKER_VIEW_KEY)).toBe("list");
    expect(readPickerView(storage)).toBe("list");
    expect(readPickerView(memory({ [PICKER_VIEW_KEY]: "cards" }))).toBe("grid");
  });
  it("survives storage that refuses", () => {
    const refusing = {
      getItem: () => {
        throw new Error("no");
      },
      setItem: () => {
        throw new Error("no");
      },
    };
    expect(readPickerView(refusing)).toBe("grid");
    expect(() => writePickerView("list", refusing)).not.toThrow();
  });
});

describe("grid layout per size", () => {
  // The inner width of the list region on each reference screen (screen less two gutters and the region's padding).
  const sizes = [
    ["se", 375 - 32 - 20, "phone", 2],
    ["pixel", 412 - 32 - 20, "phone", 2],
    ["tablet-portrait", 768 - 48 - 20, "tabletPortrait", 3],
    ["tablet", 1024 - 48 - 20, "tabletLandscape", 5],
    ["desktop", 1440 - 48 - 20, "desktop", 6],
  ] as const;
  for (const [name, width, form, columns] of sizes) {
    it(`${name}: ${columns} columns that fill the width`, () => {
      const layout = pickerGridLayout(width, form);
      expect(layout.columns).toBe(columns);
      const used = layout.columns * layout.tileWidth + (layout.columns - 1) * layout.gap;
      expect(used).toBeLessThanOrEqual(width);
      expect(used).toBeGreaterThan(width - layout.columns);
      expect(layout.tileHeight).toBe(layout.artHeight + layout.textHeight);
    });
  }
  it("gives fewer columns beside an open slide-out, and never fewer than one", () => {
    expect(pickerGridLayout(1440 - 48 - 20 - 440 - 12, "desktop").columns).toBe(5);
    expect(pickerGridLayout(1024 - 48 - 20 - 360 - 12, "tabletLandscape").columns).toBe(3);
    expect(pickerGridLayout(40, "phone").columns).toBe(1);
  });
  it("places tiles row by row and measures the content", () => {
    const layout = pickerGridLayout(333, "phone");
    expect(tileRect(layout, 5, 7, 0)).toMatchObject({ x: 5, y: 7 });
    const third = tileRect(layout, 5, 7, 2);
    expect(third.x).toBe(5);
    expect(third.y).toBe(7 + layout.tileHeight + layout.gap);
    expect(gridContentHeight(layout, 0)).toBe(0);
    expect(gridContentHeight(layout, 3)).toBe(2 * layout.tileHeight + layout.gap);
  });
});

describe("details presentation", () => {
  it("slides out on a desktop and a landscape tablet, a sheet everywhere else", () => {
    expect(detailsPresentationOf("desktop")).toBe("slide");
    expect(detailsPresentationOf("tabletLandscape")).toBe("slide");
    expect(detailsPresentationOf("tabletPortrait")).toBe("sheet");
    expect(detailsPresentationOf("phone")).toBe("sheet");
    expect(detailsPresentationOf("phoneLandscape")).toBe("sheet");
  });
  it("puts the slide-out at the right edge and the sheet over the whole area", () => {
    const area = { x: 0, y: 60, width: 1440, height: 840 };
    expect(detailsPanelRect(area, "slide", "desktop")).toEqual({ x: 1000, y: 60, width: 440, height: 840 });
    expect(detailsPanelRect(area, "sheet", "phone")).toEqual(area);
    expect(detailsPanelRect({ ...area, width: 300 }, "slide", "tabletLandscape").width).toBe(300);
  });
  it("comes in from the right (slide) or from below (sheet), settled at progress 1 and at once under reduced motion", () => {
    const panel = { x: 1000, y: 60, width: 440, height: 840 };
    expect(panelOffsetAt(0, "slide", panel, false)).toEqual({ x: 440, y: 0 });
    expect(panelOffsetAt(1, "slide", panel, false)).toEqual({ x: 0, y: 0 });
    expect(panelOffsetAt(0.5, "slide", panel, false).x).toBeLessThan(220);
    expect(panelOffsetAt(0, "sheet", panel, false)).toEqual({ x: 0, y: Math.round(840 * 0.35) });
    expect(panelOffsetAt(0, "slide", panel, true)).toEqual({ x: 0, y: 0 });
    expect(panelOffsetAt(7, "sheet", panel, false)).toEqual({ x: 0, y: 0 });
  });
});

describe("tile title", () => {
  it("drops the aspect parenthetical a tile already shows", () => {
    expect(tileTitleOf("Spider-Man (Justice) — Core Set starter deck")).toBe("Spider-Man — Core Set starter deck");
    expect(tileTitleOf("Spider-Woman (Aggression & Justice) — starter")).toBe("Spider-Woman — starter");
    expect(tileTitleOf("Hawkeye (Leadership)")).toBe("Hawkeye");
  });
  it("keeps names with nothing else to say and parentheses that are not aspects", () => {
    expect(tileTitleOf("(Justice)")).toBe("(Justice)");
    expect(tileTitleOf("Iron Man (v2)")).toBe("Iron Man (v2)");
  });
});

describe("pickerControlsLayout", () => {
  const base = { top: 100, toggleWidth: 58, searchHeight: 52, buttonHeight: 44 } as const;
  const overlap = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  // Content widths at phone 375, phone 412, portrait tablet 768, tablet 1024 beside the 360 panel, desktop beside 440.
  for (const [name, left, right] of [
    ["phone 375", 16, 359],
    ["phone 412", 16, 396],
    ["tablet portrait 768", 32, 736],
    ["tablet 1024 with the panel open", 32, 1024 - 360 - 12 - 0],
    ["desktop with the panel open", 40, 1440 - 440 - 12],
  ] as const) {
    for (const importOpen of [false, true]) {
      it(`${name}, import ${importOpen ? "open" : "closed"}: every control is in the width, a touch target and apart`, () => {
        const layout = pickerControlsLayout({ ...base, left, right, importOpen });
        const rects = [
          layout.search,
          ...layout.toggles,
          layout.build,
          layout.importToggle,
          ...(layout.importField ? [layout.importField] : []),
          ...(layout.importGo ? [layout.importGo] : []),
        ];
        expect(rects.length).toBe(importOpen ? 7 : 5);
        for (const r of rects) {
          expect(r.x).toBeGreaterThanOrEqual(left);
          expect(r.x + r.width).toBeLessThanOrEqual(right);
          expect(r.height).toBeGreaterThanOrEqual(44);
          expect(r.width).toBeGreaterThanOrEqual(58);
        }
        rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
        expect(layout.bottom).toBe(Math.max(...rects.map((r) => r.y + r.height)));
        // Build a deck and Import sit side by side, equal within a pixel.
        expect(Math.abs(layout.build.width - layout.importToggle.width)).toBeLessThanOrEqual(1);
      });
    }
  }

  it("the field has room to type in on a phone", () => {
    const layout = pickerControlsLayout({ ...base, left: 16, right: 359, importOpen: true });
    expect(layout.importField!.width).toBeGreaterThanOrEqual(200);
  });
});
