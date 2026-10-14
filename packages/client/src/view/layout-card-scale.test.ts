/**
 * The Card size setting's layout (`LayoutOptions.cardScale`): at Large and Extra large the table's zones are laid out
 * taller than the window between the pinned bands and scroll. These tests hold the geometry to what a player needs on
 * every form factor, docked villain phase or not: nothing overlaps, nothing falls outside the scrolling content, the
 * scroll reaches all of it, the pinned bands stay on screen and clear of the window, and the card slots the zones
 * hand out are not cut off.
 */
import { describe, expect, test } from "vitest";
import { cardSizeFactor } from "../settings.js";
import { handRow } from "./hand-row.js";
import {
  SCROLLING_ZONES,
  boardLayout,
  cardRow,
  formFactorFor,
  rectsOverlap,
  scrollLayout,
  villainRowSlots,
  type BoardLayout,
  type PhoneTab,
  type Rect,
  type ZoneName,
} from "./layout.js";

const SIZES = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;
const FACTORS = [1, cardSizeFactor("large"), cardSizeFactor("xlarge")] as const;
const DOCKS = [0, 360] as const;
const PLAYERS = [1, 3] as const;

const EPS = 0.51;
const bottom = (r: Rect): number => r.y + r.height;
const right = (r: Rect): number => r.x + r.width;
const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x - EPS &&
  inner.y >= outer.y - EPS &&
  right(inner) <= right(outer) + EPS &&
  bottom(inner) <= bottom(outer) + EPS;

const scrollingZones = (layout: BoardLayout): [ZoneName, Rect][] =>
  SCROLLING_ZONES.flatMap((name) => (layout.zones[name] ? [[name, layout.zones[name]!] as [ZoneName, Rect]] : []));

/** Every variation of one viewport: tabs on the tabbed form factors, one pass otherwise. */
function cases(): { label: string; layout: BoardLayout; factor: number }[] {
  const out: { label: string; layout: BoardLayout; factor: number }[] = [];
  for (const size of SIZES) {
    for (const factor of FACTORS) {
      for (const dock of DOCKS) {
        for (const playerCount of PLAYERS) {
          // The villain phase only docks beside a long table (desktop and tablet landscape).
          if (
            dock > 0 &&
            formFactorFor(size.width, size.height) !== "desktop" &&
            formFactorFor(size.width, size.height) !== "tabletLandscape"
          )
            continue;
          const probe = boardLayout({ x: 0, y: 0, ...size }, { playerCount, cardScale: factor });
          const tabs: (PhoneTab | undefined)[] = probe.tabbed
            ? ["threat", "enemies", "me", "team", "log"]
            : [undefined];
          for (const activeTab of tabs) {
            const layout = boardLayout(
              { x: 0, y: 0, ...size },
              {
                playerCount,
                cardScale: factor,
                ...(activeTab ? { activeTab } : {}),
                ...(dock > 0 ? { villainDock: dock } : {}),
              },
            );
            out.push({
              label: `${size.width}x${size.height} x${factor} dock=${dock} players=${playerCount} tab=${activeTab ?? "-"}`,
              layout,
              factor,
            });
          }
        }
      }
    }
  }
  return out;
}

describe("card scale layout", () => {
  const all = cases();

  test("scale 1 scrolls nothing: the content is exactly the window", () => {
    for (const { label, layout, factor } of all) {
      if (factor !== 1) continue;
      expect(layout.maxScroll, label).toBe(0);
      expect(layout.contentHeight, label).toBe(layout.tableWindow.height);
    }
  });

  test("scale 1 is the layout the board always had", () => {
    for (const size of SIZES) {
      const viewport = { x: 0, y: 0, ...size };
      const plain = boardLayout(viewport, { playerCount: 2 });
      const scaled = boardLayout(viewport, { playerCount: 2, cardScale: 1 });
      expect(scaled).toEqual(plain);
    }
  });

  test("every scrolling zone lies inside the content extent and in the table's width", () => {
    for (const { label, layout } of all) {
      const extent: Rect = {
        x: layout.tableWindow.x,
        y: layout.tableWindow.y,
        width: layout.tableWindow.width,
        height: layout.contentHeight,
      };
      for (const [name, rect] of scrollingZones(layout)) {
        expect(inside(rect, extent), `${label} ${name} ${JSON.stringify(rect)} in ${JSON.stringify(extent)}`).toBe(
          true,
        );
      }
    }
  });

  test("no two zones overlap (the pinned ones against each other, the scrolling ones against each other)", () => {
    for (const { label, layout } of all) {
      const scrolling = scrollingZones(layout);
      for (let i = 0; i < scrolling.length; i++) {
        for (let j = i + 1; j < scrolling.length; j++) {
          expect(
            rectsOverlap(scrolling[i]![1], scrolling[j]![1]),
            `${label} ${scrolling[i]![0]} x ${scrolling[j]![0]}`,
          ).toBe(false);
        }
      }
      const pinned = (["chrome", "tabs", "hand", "actionBar"] as const).flatMap((name) =>
        layout.zones[name] ? [[name, layout.zones[name]!] as [ZoneName, Rect]] : [],
      );
      for (let i = 0; i < pinned.length; i++) {
        for (let j = i + 1; j < pinned.length; j++) {
          // The landscape phone's rail runs down beside the hand; its own x range keeps it clear.
          expect(rectsOverlap(pinned[i]![1], pinned[j]![1]), `${label} ${pinned[i]![0]} x ${pinned[j]![0]}`).toBe(
            false,
          );
        }
      }
    }
  });

  test("the scroll extent reaches every zone: scrolled to the end, the last zone's bottom is in the window", () => {
    for (const { label, layout } of all) {
      const end = scrollLayout(layout, layout.maxScroll);
      expect(end.scrollY, label).toBe(layout.maxScroll);
      for (const [name, rect] of scrollingZones(end)) {
        expect(bottom(rect), `${label} ${name} bottom`).toBeLessThanOrEqual(bottom(layout.tableWindow) + EPS);
      }
      // And one pixel past the end is clamped, never overshooting into empty space.
      expect(scrollLayout(layout, layout.maxScroll + 500).scrollY, label).toBe(layout.maxScroll);
      expect(scrollLayout(layout, -50).scrollY, label).toBe(0);
      // The top of the content is reachable too: the first zone starts at or below the window top at rest.
      for (const [name, rect] of scrollingZones(layout)) {
        expect(rect.y, `${label} ${name} top`).toBeGreaterThanOrEqual(layout.tableWindow.y - EPS);
      }
    }
  });

  test("scrolling moves only the table zones, by exactly the offset", () => {
    for (const { label, layout } of all) {
      if (layout.maxScroll === 0) continue;
      const moved = scrollLayout(layout, 40);
      for (const name of Object.keys(layout.zones) as ZoneName[]) {
        const before = layout.zones[name];
        const after = moved.zones[name];
        if (!before || !after) continue;
        const dy = SCROLLING_ZONES.includes(name) ? -40 : 0;
        expect(after, `${label} ${name}`).toEqual({ ...before, y: before.y + dy });
      }
    }
  });

  test("the pinned chrome, hand and action bar stay in the viewport and clear of the table window", () => {
    for (const { label, layout } of all) {
      for (const name of ["chrome", "tabs", "hand", "actionBar"] as const) {
        const zone = layout.zones[name];
        if (!zone) continue;
        expect(inside(zone, layout.viewport), `${label} ${name} in viewport`).toBe(true);
      }
      const win = layout.tableWindow;
      for (const name of ["chrome", "tabs", "hand", "actionBar"] as const) {
        const zone = layout.zones[name];
        if (zone) expect(rectsOverlap(zone, win), `${label} ${name} vs window`).toBe(false);
      }
      expect(win.height, `${label} window has room`).toBeGreaterThan(Math.min(120, layout.viewport.height * 0.25));
    }
  });

  test("zone heights grow with the factor and widths do not change", () => {
    for (const size of SIZES) {
      for (const dock of DOCKS) {
        const ff = formFactorFor(size.width, size.height);
        if (dock > 0 && ff !== "desktop" && ff !== "tabletLandscape") continue;
        const at = (factor: number): BoardLayout =>
          boardLayout(
            { x: 0, y: 0, ...size },
            { playerCount: 2, cardScale: factor, ...(dock > 0 ? { villainDock: dock } : {}) },
          );
        const [one, large, xlarge] = FACTORS.map(at) as [BoardLayout, BoardLayout, BoardLayout];
        for (const name of SCROLLING_ZONES) {
          const a = one.zones[name];
          const b = large.zones[name];
          const c = xlarge.zones[name];
          if (!a || !b || !c) continue;
          const label = `${size.width}x${size.height} dock=${dock} ${name}`;
          expect(b.height, label).toBeGreaterThan(a.height);
          expect(c.height, label).toBeGreaterThan(b.height);
          // The identity column is sized by its band's height (a taller band wants a wider card), so the player band
          // is held to its total width instead; every other zone keeps its width exactly.
          if (name === "me" || name === "playArea" || name === "team") continue;
          expect(b.width, label).toBe(a.width);
          expect(c.width, label).toBe(a.width);
        }
        const playerBandWidth = (l: BoardLayout): number =>
          (l.zones.me?.width ?? 0) + (l.zones.playArea?.width ?? 0) + (l.zones.team?.width ?? 0);
        if (!one.tabbed) {
          expect(playerBandWidth(large), `${size.width}x${size.height} dock=${dock}`).toBe(playerBandWidth(one));
          expect(playerBandWidth(xlarge)).toBe(playerBandWidth(one));
        }
        expect(large.maxScroll).toBeGreaterThan(0);
        expect(xlarge.maxScroll).toBeGreaterThan(large.maxScroll);
        expect(xlarge.zones.hand!.height).toBeGreaterThanOrEqual(one.zones.hand!.height);
      }
    }
  });

  test("card slots from cardRow, villainRowSlots and the hand row lie fully inside their zone", () => {
    for (const { label, layout } of all) {
      const { zones } = layout;
      const bands = [zones.enemies, zones.playArea, zones.team, zones.threat].filter((z): z is Rect => z !== null);
      for (const zone of bands) {
        for (const count of [1, 5, 12]) {
          for (const slot of cardRow(zone, count, { gap: 8, maxHeight: zone.height })) {
            expect(
              inside(slot, zone),
              `${label} cardRow ${count} ${JSON.stringify(slot)} in ${JSON.stringify(zone)}`,
            ).toBe(true);
          }
          // Only the enemies band holds villain panels.
          for (const slot of zone === zones.enemies ? villainRowSlots(zone, Math.min(count, 4)) : []) {
            expect(inside(slot, zone), `${label} villainRowSlots ${count} ${JSON.stringify(slot)}`).toBe(true);
          }
        }
      }
      const hand = zones.hand!;
      for (const count of [1, 5, 12]) {
        const row = handRow(hand, {
          handCount: count,
          tableTiles: 0,
          fan: layout.tabbed ? "expanded" : false,
          piles: layout.tabbed ? "stacked" : "flank",
        });
        for (const slot of row.slots) {
          // A tabbed hand runs past its width on purpose and scrolls sideways: its height is what must fit.
          const bounds = layout.tabbed ? { ...hand, width: Number.MAX_SAFE_INTEGER } : hand;
          expect(
            inside(slot, bounds),
            `${label} hand ${count} ${JSON.stringify(slot)} in ${JSON.stringify(hand)}`,
          ).toBe(true);
        }
        expect(inside(row.deck, hand), `${label} deck pile`).toBe(true);
        expect(inside(row.discard, hand), `${label} discard pile`).toBe(true);
      }
    }
  });

  test("a bigger factor gives the table's card slots more height, not less", () => {
    for (const size of SIZES) {
      const slotHeight = (factor: number): number => {
        const layout = boardLayout({ x: 0, y: 0, ...size }, { playerCount: 1, cardScale: factor, activeTab: "me" });
        const area = layout.zones.playArea!;
        return cardRow(area, 3, { gap: 8, maxHeight: area.height })[0]!.height;
      };
      const label = `${size.width}x${size.height}`;
      expect(slotHeight(cardSizeFactor("large")), label).toBeGreaterThanOrEqual(slotHeight(1) - 0.01);
      expect(slotHeight(cardSizeFactor("xlarge")), label).toBeGreaterThanOrEqual(
        slotHeight(cardSizeFactor("large")) - 0.01,
      );
    }
  });
});
