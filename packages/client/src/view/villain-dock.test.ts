import { describe, expect, test } from "vitest";
import { boardLayout, type Rect } from "./layout.js";
import { villainDockRects, villainDockWidthFor, villainPresentationFor } from "./villain-dock.js";

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
