import { describe, expect, test } from "vitest";
import { boardLayout, formFactorFor, PHONE_TABS, type FormFactor, type Rect, type ZoneName } from "./layout.js";
import {
  fullyVisible,
  MAIN_COMPACT_HEIGHT,
  schemeListLayout,
  SIDE_SCHEME_HEIGHT,
  visibleSlice,
} from "./scheme-list-layout.js";
import { VariableListScroll } from "./variable-list-scroll.js";

/** The board's form factors at the sizes people actually hold them, including a tablet with browser chrome on it. */
const VIEWPORTS: readonly { readonly name: string; readonly width: number; readonly height: number }[] = [
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "desktop 1920x1080", width: 1920, height: 1080 },
  { name: "desktop 1280x720", width: 1280, height: 720 },
  { name: "tablet landscape 1024x768", width: 1024, height: 768 },
  { name: "tablet landscape 1180x820", width: 1180, height: 820 },
  { name: "tablet landscape 1366x1024", width: 1366, height: 1024 },
  { name: "tablet landscape with browser chrome 1250x700", width: 1250, height: 700 },
  { name: "tablet landscape with browser chrome 1024x600", width: 1024, height: 600 },
  { name: "tablet portrait 768x1024", width: 768, height: 1024 },
  { name: "phone 390x844", width: 390, height: 844 },
  { name: "phone landscape 844x390", width: 844, height: 390 },
];

const inside = (inner: Rect, outer: Rect, slack = 0.01): boolean =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.width <= outer.x + outer.width + slack &&
  inner.y + inner.height <= outer.y + outer.height + slack;

const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width - 0.01 &&
  b.x < a.x + a.width - 0.01 &&
  a.y < b.y + b.height - 0.01 &&
  b.y < a.y + a.height - 0.01;

describe("the schemes column's rows", () => {
  describe.each(VIEWPORTS)("$name", ({ width, height }) => {
    const viewport: Rect = { x: 0, y: 0, width, height };
    // The phone's threat tab is one zone at a time, so the threat zone has to be asked for on that tab.
    const layout = boardLayout(viewport, { playerCount: 2, activeTab: "threat" });
    const panel = layout.zones.threat!;

    test.each([1, 2, 3, 4, 5, 6, 7, 8])("%i schemes: no drawn row leaves the panel", (total) => {
      for (const mains of [1, 2]) {
        const sides = Math.max(0, total - mains);
        if (mains === 2 && total < 2) continue;
        const list = schemeListLayout(panel, { mains, sides, tabbed: layout.tabbed });
        expect(list.rows).toHaveLength(mains + sides);

        if (!list.scrolls) {
          // Nothing scrolls, so every row sits wholly inside the panel, one under the other.
          expect(list.viewport === null || list.heights.length === 0).toBe(true);
          let bottom = -Infinity;
          for (const row of list.rows) {
            expect(inside(row.rect, panel)).toBe(true);
            expect(row.rect.y).toBeGreaterThanOrEqual(bottom - 0.01);
            bottom = row.rect.y + row.rect.height;
          }
          continue;
        }

        // It scrolls: the content is taller than the viewport, the viewport is inside the panel, the pinned rows are
        // inside the panel and above it, and no scrolling row can be seen outside it at any offset.
        const view = list.viewport!;
        expect(inside(view, panel)).toBe(true);
        const content = list.heights.reduce((sum, h) => sum + h, 0);
        expect(content).toBeGreaterThan(view.height);
        const scrollRows = list.rows.filter((row) => !row.pinned);
        expect(scrollRows.length).toBe(list.heights.length);
        for (const row of list.rows.filter((r) => r.pinned)) {
          expect(inside(row.rect, panel)).toBe(true);
          expect(row.rect.y + row.rect.height).toBeLessThanOrEqual(view.y + 0.01);
        }
        // A pinned main scheme is never left with a viewport that cannot show a side scheme and a peek of the next.
        if (list.rows.some((row) => row.pinned)) expect(view.height).toBeGreaterThanOrEqual(SIDE_SCHEME_HEIGHT + 20);
        const maxOffset = content - view.height;
        for (const offset of [0, maxOffset / 2, maxOffset]) {
          for (const row of scrollRows) {
            const slice = visibleSlice(row.rect, offset, view);
            if (slice) expect(inside(slice, view)).toBe(true);
          }
        }
        // Row 0 starts inside the viewport at rest, and the last row ends inside it at the far end.
        expect(scrollRows[0]!.rect.y).toBeGreaterThanOrEqual(view.y);
        const last = scrollRows[scrollRows.length - 1]!;
        expect(last.rect.y + last.rect.height - maxOffset).toBeLessThanOrEqual(view.y + view.height + 0.01);
        // Every scheme can be scrolled wholly into view, so a target scrolled off is reachable.
        for (const row of scrollRows) {
          const scroll = new VariableListScroll();
          scroll.scrollIntoView(row.scrollIndex, list.heights, view.height);
          expect(fullyVisible(row.rect, scroll.offsetPx, view)).toBe(true);
        }
      }
    });
  });

  test("the owner's tablet case: a main scheme and two side schemes fit a 1250x700 panel without scrolling", () => {
    const panel = boardLayout({ x: 0, y: 0, width: 1250, height: 700 }, { playerCount: 1 }).zones.threat!;
    const list = schemeListLayout(panel, { mains: 1, sides: 2, tabbed: false });
    expect(list.scrolls).toBe(false);
    // The main row is compact there, not 92 px: the room is only just enough.
    expect(list.rows[0]!.rect.height).toBe(MAIN_COMPACT_HEIGHT);
  });

  test("a tall zone still grows the rows to their old sizes, and three side schemes keep the 92/52 rows", () => {
    const tall = schemeListLayout({ x: 0, y: 0, width: 420, height: 400 }, { mains: 1, sides: 1, tabbed: false });
    expect(tall.scrolls).toBe(false);
    expect(tall.rows[0]!.rect.height).toBeGreaterThan(92);
    const nominal = schemeListLayout(
      { x: 0, y: 0, width: 420, height: 20 + 92 + 3 * 52 + 18 },
      { mains: 1, sides: 3, tabbed: false },
    );
    expect(nominal.rows.map((row) => row.rect.height)).toEqual([92, 52, 52, 52]);
  });

  test("a panel too short to pin the main scheme scrolls the whole list, main scheme first", () => {
    const list = schemeListLayout({ x: 0, y: 0, width: 300, height: 120 }, { mains: 1, sides: 3, tabbed: false });
    expect(list.scrolls).toBe(true);
    expect(list.rows.every((row) => !row.pinned)).toBe(true);
    expect(list.rows[0]!.kind).toBe("main");
  });

  test("with five schemes on a desktop the main scheme is pinned and the sides scroll", () => {
    const panel = boardLayout({ x: 0, y: 0, width: 1440, height: 900 }, { playerCount: 1 }).zones.threat!;
    const list = schemeListLayout(panel, { mains: 1, sides: 7, tabbed: false });
    expect(list.scrolls).toBe(true);
    expect(list.rows.filter((row) => row.pinned)).toHaveLength(1);
    expect(list.rows.filter((row) => !row.pinned)).toHaveLength(7);
  });
});

describe("board panels never overlap", () => {
  const NAMES: readonly ZoneName[] = [
    "chrome",
    "tabs",
    "threat",
    "enemies",
    "me",
    "playArea",
    "team",
    "encounter",
    "log",
    "hand",
    "actionBar",
  ];

  describe.each(VIEWPORTS)("$name", ({ width, height }) => {
    const viewport: Rect = { x: 0, y: 0, width, height };
    const factor: FormFactor = formFactorFor(width, height);
    const tabsToCheck =
      factor === "phone" || factor === "tabletPortrait" || factor === "phoneLandscape" ? PHONE_TABS : [undefined];

    test.each([1, 2, 4])("%i seats: every pair of zones is disjoint and on screen", (seats) => {
      for (const tab of tabsToCheck) {
        const layout = boardLayout(viewport, { playerCount: seats, ...(tab ? { activeTab: tab } : {}) });
        const zones = NAMES.flatMap((name) => {
          const rect = layout.zones[name];
          return rect ? [{ name, rect }] : [];
        });
        for (const { name, rect } of zones) {
          expect(inside(rect, viewport), `${name} on ${tab ?? "the table"} is on screen`).toBe(true);
        }
        for (let a = 0; a < zones.length; a++) {
          for (let b = a + 1; b < zones.length; b++) {
            expect(
              intersects(zones[a]!.rect, zones[b]!.rect),
              `${zones[a]!.name} and ${zones[b]!.name} overlap at ${width}x${height} (${tab ?? "table"}, ${seats} seats)`,
            ).toBe(false);
          }
        }
      }
    });
  });
});
