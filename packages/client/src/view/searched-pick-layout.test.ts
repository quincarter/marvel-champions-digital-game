import { describe, expect, test } from "vitest";
import { rectsOverlap, type Rect } from "./layout.js";
import { MIN_FACE_WIDTH, searchedPickLayout } from "./searched-pick-layout.js";

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe("searchedPickLayout", () => {
  for (const [name, width, height] of [
    ["desktop", 1280, 720],
    ["tablet", 1024, 768],
    ["phone", 390, 780],
    ["phone landscape", 780, 360],
  ] as const) {
    for (const count of [1, 2, 3, 6]) {
      test(`${name}, ${count} candidates: tiles stay inside the sheet and never overlap`, () => {
        const layout = searchedPickLayout({ x: 0, y: 0, width, height }, count);
        expect(layout.tiles).toHaveLength(count);
        for (const t of layout.tiles) {
          expect(inside(t.tile, layout.sheet)).toBe(true);
          expect(inside(t.face, t.tile)).toBe(true);
          expect(inside(t.inspect, t.tile)).toBe(true);
          expect(rectsOverlap(t.tag, t.face)).toBe(false);
          expect(rectsOverlap(t.inspect, t.caption)).toBe(false);
        }
        layout.tiles.forEach((a, i) =>
          layout.tiles.slice(i + 1).forEach((b) => expect(rectsOverlap(a.tile, b.tile)).toBe(false)),
        );
        expect(rectsOverlap(layout.cancel, layout.title)).toBe(false);
        for (const t of layout.tiles) expect(rectsOverlap(t.tile, layout.cancel)).toBe(false);
      });
    }
  }

  test("a face keeps the card's 5:7 shape", () => {
    const [t] = searchedPickLayout({ x: 0, y: 0, width: 1280, height: 720 }, 2).tiles;
    expect(Math.abs(t!.face.height / t!.face.width - 1.4)).toBeLessThan(0.02);
  });
});

describe("searchedPickLayout: the title beside Cancel (click-through F15)", () => {
  const prompt = "Hunted: choose the minion to search for and attach it to";
  for (const width of [360, 390, 600, 780, 1024, 1440]) {
    test(`${width} px wide: the title may wrap to two lines inside its own box, clear of Cancel and the sheet`, () => {
      const layout = searchedPickLayout({ x: 0, y: 0, width, height: 780 }, 3);
      expect(layout.titleLines).toBe(2);
      // Two lines of 16 px type at a 1.25 line height fit the box.
      expect(layout.title.height).toBeGreaterThanOrEqual(layout.titleLines * 16 * 1.25);
      expect(layout.title.x + layout.title.width).toBeLessThanOrEqual(layout.cancel.x);
      expect(layout.title.x).toBeGreaterThanOrEqual(layout.sheet.x);
      expect(layout.title.y).toBeGreaterThanOrEqual(layout.sheet.y);
      // The longest prompt, at the narrowest width, still gets at least half of the words' worth of room per line:
      // about 8 px a character at 16 px type, two lines.
      expect(layout.title.width * layout.titleLines).toBeGreaterThanOrEqual(prompt.length * 7);
    });
  }
});

describe("searchedPickLayout: a long list pages instead of leaving the sheet (Make the Call, #420)", () => {
  const all = (layout: ReturnType<typeof searchedPickLayout>): Rect[] => [
    layout.title,
    layout.cancel,
    ...(layout.confirm ? [layout.confirm] : []),
    ...(layout.pager ? [layout.pager.previous, layout.pager.label, layout.pager.next] : []),
  ];
  for (const [name, width, height] of [
    ["the reporter's phone", 360, 788],
    ["phone", 390, 780],
    ["phone landscape", 780, 360],
    ["tablet", 1024, 768],
    ["desktop", 1280, 720],
  ] as const) {
    for (const count of [7, 13, 20, 40]) {
      test(`${name}, ${count} candidates with Confirm: every option is on a page, whole, at a readable size`, () => {
        const viewport = { x: 0, y: 0, width, height };
        const shown = new Set<number>();
        const pages = searchedPickLayout(viewport, count, true).pager?.pages ?? 1;
        for (let page = 0; page < pages; page++) {
          const layout = searchedPickLayout(viewport, count, true, page);
          expect(layout.first).toBe(shown.size);
          layout.tiles.forEach((t, i) => {
            shown.add(layout.first + i);
            expect(inside(t.tile, layout.sheet)).toBe(true);
            expect(inside(t.tile, viewport)).toBe(true);
            expect(t.face.width).toBeGreaterThanOrEqual(MIN_FACE_WIDTH);
            for (const control of all(layout)) expect(rectsOverlap(t.tile, control)).toBe(false);
          });
          layout.tiles.forEach((a, i) =>
            layout.tiles.slice(i + 1).forEach((b) => expect(rectsOverlap(a.tile, b.tile)).toBe(false)),
          );
          for (const control of all(layout)) expect(inside(control, layout.sheet)).toBe(true);
        }
        expect(shown.size).toBe(count);
      });
    }
  }

  test("360 px wide, 13 allies: no column runs past the sheet (the review's 5 columns were 368 px in 312)", () => {
    const layout = searchedPickLayout({ x: 0, y: 0, width: 360, height: 788 }, 13, true);
    const right = Math.max(...layout.tiles.map((t) => t.tile.x + t.tile.width));
    expect(right).toBeLessThanOrEqual(layout.sheet.x + layout.sheet.width - 16);
    expect(layout.pager).not.toBeNull();
  });

  test("a list that fits has no pager, and a page past the end shows the last page", () => {
    expect(searchedPickLayout({ x: 0, y: 0, width: 1280, height: 720 }, 6, true).pager).toBeNull();
    const last = searchedPickLayout({ x: 0, y: 0, width: 360, height: 788 }, 13, true, 99);
    expect(last.pager!.page).toBe(last.pager!.pages - 1);
    expect(last.first + last.tiles.length).toBe(13);
  });
});

describe("searchedPickLayout: the title with Confirm and Cancel (#420)", () => {
  const prompt = "Make the Call: choose the ally whose cost you pay";
  for (const width of [360, 390, 600, 780, 1024, 1440]) {
    test(`${width} px wide: the title gets two full lines of room, clear of both buttons`, () => {
      const layout = searchedPickLayout({ x: 0, y: 0, width, height: 780 }, 3, true);
      expect(layout.title.width).toBeGreaterThanOrEqual(200);
      expect(layout.title.width * layout.titleLines).toBeGreaterThanOrEqual(prompt.length * 7);
      expect(rectsOverlap(layout.title, layout.cancel)).toBe(false);
      expect(rectsOverlap(layout.title, layout.confirm!)).toBe(false);
      expect(rectsOverlap(layout.confirm!, layout.cancel)).toBe(false);
      expect(inside(layout.confirm!, layout.sheet)).toBe(true);
      for (const t of layout.tiles) {
        expect(rectsOverlap(t.tile, layout.cancel)).toBe(false);
        expect(rectsOverlap(t.tile, layout.confirm!)).toBe(false);
      }
    });
  }

  test("on a phone the buttons go under the title; on a desktop they stay beside it", () => {
    const phone = searchedPickLayout({ x: 0, y: 0, width: 360, height: 788 }, 3, true);
    expect(phone.stackedHeader).toBe(true);
    expect(phone.cancel.y).toBeGreaterThanOrEqual(phone.title.y + phone.title.height);
    const desktop = searchedPickLayout({ x: 0, y: 0, width: 1280, height: 720 }, 3, true);
    expect(desktop.stackedHeader).toBe(false);
    expect(desktop.cancel.y).toBe(desktop.title.y);
    // Hunted's Cancel alone still fits beside the title at 360 px.
    expect(searchedPickLayout({ x: 0, y: 0, width: 360, height: 788 }, 3).stackedHeader).toBe(false);
  });
});
