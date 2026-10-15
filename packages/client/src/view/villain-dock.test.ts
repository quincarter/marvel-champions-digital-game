import { describe, expect, test } from "vitest";
import { boardLayout, cardRow, scrollLayout, type Rect } from "./layout.js";
import {
  villainDockRects,
  villainDockWidthFor,
  villainPresentationFor,
  villainWideDockWidthFor,
} from "./villain-dock.js";

const rect = (width: number, height: number): Rect => ({ x: 0, y: 0, width, height });
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("villainPresentationFor", () => {
  const base = { dockTable: true, recap: false, peeking: false } as const;
  test.each([
    ["desktop", "rail"],
    ["tabletLandscape", "band"],
    ["tabletPortrait", "tab"],
    ["phone", "tab"],
    ["phoneLandscape", "full"],
  ] as const)("%s docks as %s", (formFactor, kind) => {
    expect(villainPresentationFor({ ...base, formFactor })).toBe(kind);
  });

  test("the recap and the setting turned off are full screen everywhere", () => {
    expect(villainPresentationFor({ ...base, formFactor: "desktop", recap: true })).toBe("full");
    expect(villainPresentationFor({ ...base, formFactor: "phone", dockTable: false })).toBe("full");
  });

  test("peeking only applies where the phase is a tab", () => {
    expect(villainPresentationFor({ ...base, formFactor: "phone", peeking: true })).toBe("peek");
    expect(villainPresentationFor({ ...base, formFactor: "desktop", peeking: true })).toBe("rail");
  });
});

describe("villainDockRects", () => {
  test("rail: the panel sits right of every table zone, under the chrome", () => {
    const viewport = rect(1440, 900);
    const dock = villainDockWidthFor(viewport.width);
    const layout = boardLayout(viewport, { playerCount: 2, villainDock: dock });
    const { panel, footer } = villainDockRects("rail", layout, dock);
    expect(footer).toBeNull();
    expect(panel!.y).toBe(layout.zones.chrome!.y + layout.zones.chrome!.height);
    expect(panel!.x + panel!.width).toBe(1440);
    for (const zone of [layout.zones.hand!, layout.zones.me!, layout.zones.enemies!]) {
      expect(overlaps(zone, panel!)).toBe(false);
    }
  });

  test("band: the panel covers the villain band and leaves the hero, play area and hand clear", () => {
    const layout = boardLayout(rect(1024, 768), { playerCount: 1 });
    const { panel } = villainDockRects("band", layout, 0);
    expect(panel!.height).toBeGreaterThan(200);
    for (const zone of [layout.zones.hand!, layout.zones.me!, layout.zones.playArea!]) {
      expect(overlaps(zone, panel!)).toBe(false);
    }
  });

  test("tab: the panel stops at the hand and the footer is the action bar; peek keeps only the footer", () => {
    const layout = boardLayout(rect(390, 844), { playerCount: 1 });
    const tab = villainDockRects("tab", layout, 0);
    expect(tab.panel!.y + tab.panel!.height).toBe(layout.zones.hand!.y);
    expect(tab.footer).toEqual(layout.zones.actionBar);
    const peek = villainDockRects("peek", layout, 0);
    expect(peek.panel).toBeNull();
    expect(peek.footer).toEqual(layout.zones.actionBar);
  });

  test("peek: the banner sits under the tab rail and leaves the hand and the action bar clear", () => {
    for (const [w, h] of [
      [390, 844],
      [768, 1024],
    ] as const) {
      const layout = boardLayout(rect(w, h), { playerCount: 2 });
      const { banner } = villainDockRects("peek", layout, 0);
      const tabs = layout.zones.tabs!;
      expect(banner!.y).toBeGreaterThanOrEqual(tabs.y + tabs.height);
      expect(overlaps(banner!, layout.zones.hand!)).toBe(false);
      expect(overlaps(banner!, layout.zones.actionBar!)).toBe(false);
    }
  });
});

const ZONE_NAMES = ["threat", "enemies", "encounter", "log", "me", "playArea", "team", "hand", "actionBar"] as const;

/** Every zone of `layout` (but the chrome) lies in the viewport, and no two overlap. */
function expectCleanLayout(layout: ReturnType<typeof boardLayout>, within: Rect = layout.viewport): void {
  const zones = ZONE_NAMES.flatMap((name) => (layout.zones[name] ? [[name, layout.zones[name]!] as const] : []));
  for (const [name, zone] of zones) {
    expect(zone.width, name).toBeGreaterThan(0);
    expect(zone.height, name).toBeGreaterThan(0);
    expect(zone.x, name).toBeGreaterThanOrEqual(within.x);
    expect(zone.y, name).toBeGreaterThanOrEqual(within.y);
    expect(zone.x + zone.width, name).toBeLessThanOrEqual(within.x + within.width + 0.5);
    expect(zone.y + zone.height, name).toBeLessThanOrEqual(within.y + within.height + 0.5);
  }
  for (const [i, [a, ra]] of zones.entries()) {
    for (const [b, rb] of zones.slice(i + 1)) expect(overlaps(ra, rb), `${a} / ${b}`).toBe(false);
  }
}

/** The card slots a one-row `cardRow` makes for 1, 5 and 12 cards lie inside `zone`. */
function expectRowsInside(zone: Rect, label: string): void {
  for (const count of [1, 5, 12]) {
    const slots = cardRow(zone, count);
    expect(slots, `${label} x${count}`).toHaveLength(count);
    for (const slot of slots) {
      expect(slot.x, `${label} x${count}`).toBeGreaterThanOrEqual(zone.x - 0.5);
      expect(slot.x + slot.width, `${label} x${count}`).toBeLessThanOrEqual(zone.x + zone.width + 0.5);
      expect(slot.y, `${label} x${count}`).toBeGreaterThanOrEqual(zone.y - 0.5);
      expect(slot.y + slot.height, `${label} x${count}`).toBeLessThanOrEqual(zone.y + zone.height + 0.5);
    }
  }
}

describe("villainWideDockWidthFor", () => {
  test.each([
    [1280, 676],
    [1366, 721],
    [1440, 760],
    [1920, 1014],
    [2560, 1100],
    [3440, 1100],
  ])("%i px wide: the rail is %i, never over half the table's share", (width, expected) => {
    const dock = villainWideDockWidthFor(width);
    expect(Math.abs(dock - expected)).toBeLessThanOrEqual(1);
    expect(dock).toBeGreaterThan(villainDockWidthFor(width) - 1);
    expect(width - dock).toBeGreaterThanOrEqual(600);
  });
});

describe("the wide rail (B1/B2)", () => {
  test.each([
    [1280, 800],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
  ])("%ix%i: the table lays out clean in the left part", (width, height) => {
    for (const playerCount of [1, 3]) {
      const dock = villainWideDockWidthFor(width);
      const layout = boardLayout(rect(width, height), { playerCount, villainDock: dock });
      const table = { x: 0, y: 0, width: width - dock, height };
      expectCleanLayout(layout, table);
      const { panel } = villainDockRects("rail", layout, dock);
      expect(panel!.x).toBe(width - dock);
      for (const name of ZONE_NAMES)
        if (layout.zones[name]) expect(overlaps(layout.zones[name]!, panel!), name).toBe(false);
      expectRowsInside(layout.zones.hand!, "hand");
      expectRowsInside(layout.zones.playArea!, "play area");
    }
  });
});

describe("the tall band (TB1/TB2)", () => {
  test.each([
    [1024, 768],
    [1180, 820],
  ])("%ix%i: a compact player row under a taller panel", (width, height) => {
    for (const playerCount of [1, 2]) {
      const normal = boardLayout(rect(width, height), { playerCount });
      const tall = boardLayout(rect(width, height), { playerCount, villainBand: { tall: true } });
      expect(normal.compactPlayerRow).toBeUndefined();
      expect(tall.compactPlayerRow).toBe(true);
      expectCleanLayout(tall);
      const panel = villainDockRects("band", tall, 0).panel!;
      const normalPanel = villainDockRects("band", normal, 0).panel!;
      expect(panel.height).toBeGreaterThan(normalPanel.height);
      for (const name of ["me", "playArea", "team", "hand", "actionBar"] as const) {
        const zone = tall.zones[name];
        if (zone) expect(overlaps(zone, panel), name).toBe(false);
      }
      // The compact row is short; the panel keeps most of what the player band gave up.
      expect(tall.zones.me!.height).toBeLessThanOrEqual(96);
      expect(tall.zones.me!.y).toBe(tall.zones.playArea!.y);
      expectRowsInside(tall.zones.hand!, "hand");
      expectRowsInside(
        { ...tall.zones.playArea!, x: tall.zones.playArea!.x + 84, width: tall.zones.playArea!.width - 92 },
        "strip",
      );
    }
  });

  test("only a tablet landscape board takes the compact row", () => {
    expect(
      boardLayout(rect(1440, 900), { playerCount: 1, villainBand: { tall: true } }).compactPlayerRow,
    ).toBeUndefined();
  });

  test("at factor 1.5 the tall band still scrolls and the row stays one row", () => {
    const tall = boardLayout(rect(1024, 768), { playerCount: 1, villainBand: { tall: true }, cardScale: 1.5 });
    expect(scrollLayout(tall, tall.maxScroll).scrollY).toBe(tall.maxScroll);
    expect(tall.zones.me!.y).toBe(tall.zones.playArea!.y);
    expect(tall.maxScroll).toBeGreaterThan(0);
    expect(overlaps(tall.zones.hand!, villainDockRects("band", tall, 0).panel!)).toBe(false);
  });
});

describe("the tab panel (TB3)", () => {
  test("a tablet portrait still has a panel above the hand and a footer on the action bar", () => {
    const layout = boardLayout(rect(768, 1024), { playerCount: 1 });
    const { panel, footer } = villainDockRects("tab", layout, 0);
    expect(panel!.height).toBeGreaterThan(300);
    expect(panel!.y + panel!.height).toBe(layout.zones.hand!.y);
    expect(footer).toEqual(layout.zones.actionBar);
  });
});

describe("the tall band's animated growth", () => {
  test("the panel grows monotonically with `grow`, and the row turns compact at the half", () => {
    const heights = [0, 0.25, 0.5, 0.75, 1].map((grow) => {
      const layout = boardLayout(rect(1024, 768), { playerCount: 1, villainBand: { tall: grow > 0, grow } });
      expectCleanLayout(layout);
      expect(layout.compactPlayerRow === true).toBe(grow >= 0.5);
      return villainDockRects("band", layout, 0).panel!.height;
    });
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    expect(heights[4]).toBeGreaterThan(heights[0]!);
  });
});
