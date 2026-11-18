import { describe, expect, test } from "vitest";
import { boardLayout, formFactorFor, PHONE_TABS, type FormFactor, type Rect, type ZoneName } from "./layout.js";
import {
  fullyVisible,
  LARGE_TEXT_MIN_WIDTH,
  largeSchemeListLayout,
  MAIN_COMPACT_HEIGHT,
  SCHEME_CARD_ASPECT,
  schemeRowGeometry,
  schemeStackLayout,
  STACK_PEEK,
  stackOrder,
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

  test("a larger Card size grows every row by its factor, and a tall panel still fits them", () => {
    const rect = { x: 0, y: 0, width: 420, height: 20 + 92 * 1.5 + 3 * 52 * 1.5 + 18 };
    const scaled = schemeListLayout(rect, { mains: 1, sides: 3, tabbed: false, scale: 1.5 });
    expect(scaled.scrolls).toBe(false);
    expect(scaled.rows.map((row) => row.rect.height)).toEqual([138, 78, 78, 78]);
    const grown = schemeListLayout(
      { x: 0, y: 0, width: 420, height: 600 },
      { mains: 1, sides: 0, tabbed: false, scale: 1.5 },
    );
    expect(grown.rows[0]!.rect.height).toBe(225);
  });

  test("a main scheme with a line of its own (The Collection, #173) grows by that much, on a phone too", () => {
    const rect = { x: 0, y: 0, width: 370, height: 500 };
    const phone = schemeListLayout(rect, { mains: 1, sides: 1, tabbed: true, mainExtra: 21 });
    expect(phone.rows.map((row) => row.rect.height)).toEqual([113, 52]);
    // A row already grown past that keeps its size.
    const tall = schemeListLayout({ x: 0, y: 0, width: 420, height: 600 }, { mains: 1, sides: 0, tabbed: false });
    const tallWithLine = schemeListLayout(
      { x: 0, y: 0, width: 420, height: 600 },
      { mains: 1, sides: 0, tabbed: false, mainExtra: 21 },
    );
    expect(tallWithLine.rows[0]!.rect.height).toBe(tall.rows[0]!.rect.height);
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

describe("Large schemes: every scheme a large card, scrolling only inside its panel", () => {
  describe.each(VIEWPORTS)("$name", ({ width, height }) => {
    const viewport: Rect = { x: 0, y: 0, width, height };
    const layout = boardLayout(viewport, { playerCount: 2, activeTab: "threat" });
    const panel = layout.zones.threat!;

    test.each([1, 2, 3, 5])(
      "%i schemes: one whole row fits, and every row is in the panel or its viewport",
      (total) => {
        const list = largeSchemeListLayout(panel, { mains: 1, sides: total - 1 });
        expect(list.rows).toHaveLength(total);
        const { cardWidth, mode } = list.shape;
        expect(cardWidth).toBeGreaterThan(0);
        for (const row of list.rows) {
          const box = list.viewport ?? panel;
          // A row is never taller than what shows it, so scrolling can always bring one whole scheme into view.
          expect(row.rect.height).toBeLessThanOrEqual(box.height + 0.01);
          expect(row.rect.x).toBeGreaterThanOrEqual(panel.x);
          expect(row.rect.x + row.rect.width).toBeLessThanOrEqual(panel.x + panel.width + 0.01);
          const { art, text } = schemeRowGeometry(row.rect, 0, list.shape);
          expect(art).not.toBeNull();
          expect(inside(art!, row.rect)).toBe(true);
          expect(inside(text, row.rect)).toBe(true);
          expect(intersects(art!, text)).toBe(false);
          expect(Math.abs(art!.height - cardWidth * SCHEME_CARD_ASPECT)).toBeLessThan(1.01);
          if (mode === "beside") expect(text.width).toBeGreaterThanOrEqual(LARGE_TEXT_MIN_WIDTH - 0.01);
        }
        if (list.viewport) {
          expect(inside(list.viewport, panel)).toBe(true);
          expect(list.rows.every((row) => !row.pinned)).toBe(true);
          expect(list.heights).toHaveLength(total);
        } else {
          for (const row of list.rows) expect(inside(row.rect, panel)).toBe(true);
        }
      },
    );
  });

  test("a 1920x1080 desktop's scheme card is several times the size of the usual row's", () => {
    const panel = boardLayout({ x: 0, y: 0, width: 1920, height: 1080 }, { playerCount: 1 }).zones.threat!;
    const usual = schemeListLayout(panel, { mains: 1, sides: 0, tabbed: false }).rows[0]!.rect.height;
    const large = largeSchemeListLayout(panel, { mains: 1, sides: 0 });
    expect(large.shape.cardWidth * SCHEME_CARD_ASPECT).toBeGreaterThan(usual * 1.5);
  });

  test("without the setting a row's text column is where it always was", () => {
    const row: Rect = { x: 10, y: 20, width: 400, height: 92 };
    expect(schemeRowGeometry(row, 120, null)).toEqual({
      art: { x: 13, y: 23, width: 120, height: 86 },
      text: { x: 10 + 8 + 120 + 6, y: 20, width: 400 - 8 - (8 + 120 + 6), height: 92 },
      above: false,
    });
    expect(schemeRowGeometry(row, 0, null).art).toBeNull();
  });

  test("a scheme's own lines get room under an 'above' card: the meter's strip grows by them", () => {
    const panel: Rect = { x: 0, y: 0, width: 360, height: 900 };
    const plain = largeSchemeListLayout(panel, { mains: 1, sides: 0 });
    const lines = largeSchemeListLayout(panel, { mains: 1, sides: 0, infoExtra: 40 });
    expect(plain.shape.mode).toBe("above");
    const strip = (list: typeof plain) => schemeRowGeometry(list.rows[0]!.rect, 0, list.shape).text.height;
    expect(strip(lines) - strip(plain)).toBeGreaterThanOrEqual(39);
  });

  test("a narrow panel puts the card above its text, a wide one beside it", () => {
    expect(largeSchemeListLayout({ x: 0, y: 0, width: 360, height: 700 }, { mains: 1, sides: 0 }).shape.mode).toBe(
      "above",
    );
    expect(largeSchemeListLayout({ x: 0, y: 0, width: 600, height: 300 }, { mains: 1, sides: 0 }).shape.mode).toBe(
      "beside",
    );
  });
});

describe("Stack schemes: one large card at the front, the rest stacked behind it", () => {
  describe.each(VIEWPORTS)("$name", ({ width, height }) => {
    const layout = boardLayout({ x: 0, y: 0, width, height }, { playerCount: 2, activeTab: "threat" });
    const panel = layout.zones.threat!;

    test.each([2, 3, 4, 6])("%i schemes: the stack fits the panel, each card behind shows a name band", (count) => {
      const stack = schemeStackLayout(panel, count);
      expect(inside(stack.header, panel)).toBe(true);
      expect(inside(stack.front.rect, panel)).toBe(true);
      expect(stack.behind).toHaveLength(Math.min(3, count - 1));
      const frontArt = schemeRowGeometry(stack.front.rect, 0, stack.front.shape).art!;
      let above = frontArt;
      for (const { card, peek } of stack.behind) {
        expect(inside(peek, panel)).toBe(true);
        // The band is the strip of the card that stands above the one in front, and below the header.
        expect(peek.y + peek.height).toBeCloseTo(above.y, 5);
        expect(peek.y).toBeGreaterThanOrEqual(stack.header.y + stack.header.height);
        expect(card.width).toBeLessThan(above.width);
        above = card;
      }
    });
  });

  test("the front card stays large: a 1920x1080 desktop's is still well over the usual row", () => {
    const panel = boardLayout({ x: 0, y: 0, width: 1920, height: 1080 }, { playerCount: 1 }).zones.threat!;
    const stack = schemeStackLayout(panel, 4);
    expect(stack.front.shape.cardWidth).toBeGreaterThan(250);
    expect(stack.behind[0]!.peek.height).toBe(STACK_PEEK);
  });

  test("the stack's order starts at the front scheme and wraps around", () => {
    expect(stackOrder(["a", "b", "c", "d"], 2)).toEqual(["c", "d", "a", "b"]);
    expect(stackOrder(["a", "b"], -1)).toEqual(["b", "a"]);
    expect(stackOrder([], 3)).toEqual([]);
  });
});
