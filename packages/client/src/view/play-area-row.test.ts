/**
 * The play area's row (issue #119): cards keep a readable size and the row scrolls, where it used to shrink thirteen
 * cards to slivers their own ability strips covered.
 */

import { describe, expect, test, vi } from "vitest";
import type { InstanceId } from "@mc/engine";
import { CARD_ASPECT, type Rect } from "./layout.js";
import {
  FORM_ROW_HEADER,
  PLAY_AREA_GAP,
  formCardSlots,
  formColumnWidth,
  PlayAreaScroll,
  playAreaRow,
  separateColumnWidth,
  separateRowHeight,
  sliceWithin,
} from "./play-area-row.js";

/** Roughly the long table's play area at 1920×1280 with one player. */
const AREA: Rect = { x: 500, y: 700, width: 1000, height: 240 };
const ids = (count: number): InstanceId[] => Array.from({ length: count }, (_unused, at) => `card-${at}` as InstanceId);

describe("playAreaRow", () => {
  test("a few cards sit at the zone's full height, centered, and nothing scrolls", () => {
    const row = playAreaRow(AREA, 3);
    expect(row.scrolls).toBe(false);
    expect(row.slots.every((slot) => slot.height === AREA.height)).toBe(true);
    const rowWidth = row.slots.at(-1)!.x + row.slots.at(-1)!.width - row.slots[0]!.x;
    expect(row.slots[0]!.x - AREA.x).toBeCloseTo((AREA.width - rowWidth) / 2);
  });

  test("a row that is getting full shrinks its cards a little before it scrolls", () => {
    const row = playAreaRow(AREA, 7);
    expect(row.scrolls).toBe(false);
    expect(row.slots[0]!.height).toBeLessThan(AREA.height);
    expect(row.slots[0]!.height).toBeGreaterThanOrEqual(AREA.height * 0.7);
  });

  test("thirteen cards keep 70% of the zone's height, never overlap, and the row scrolls", () => {
    const row = playAreaRow(AREA, 13);
    expect(row.scrolls).toBe(true);
    expect(row.slots).toHaveLength(13);
    for (const slot of row.slots) {
      expect(slot.height).toBeCloseTo(AREA.height * 0.7);
      expect(slot.width).toBeCloseTo(AREA.height * 0.7 * CARD_ASPECT);
    }
    expect(row.slots[0]!.x).toBe(AREA.x);
    for (let at = 1; at < row.slots.length; at++) {
      expect(row.slots[at]!.x - row.slots[at - 1]!.x).toBeCloseTo(row.slots[0]!.width + PLAY_AREA_GAP);
    }
    expect(row.slots.at(-1)!.x + row.slots.at(-1)!.width).toBeGreaterThan(AREA.x + AREA.width);
  });

  test("a short zone keeps its cards at least 120px tall, or its own height when it has less", () => {
    expect(playAreaRow({ ...AREA, height: 150 }, 20).slots[0]!.height).toBe(120);
    expect(playAreaRow({ ...AREA, height: 90 }, 20).slots[0]!.height).toBe(90);
  });

  test("above Fit to screen a crowded row keeps the zone's full height and scrolls, never smaller cards than Fit to screen", () => {
    const standard = playAreaRow({ ...AREA, height: 200, width: 700 }, 5);
    const large = playAreaRow({ ...AREA, height: 300, width: 700 }, 5, 1.5);
    expect(large.slots[0]!.height).toBe(300);
    expect(large.slots[0]!.height).toBeGreaterThanOrEqual(standard.slots[0]!.height);
    expect(large.scrolls).toBe(true);
  });

  test("no cards, no slots", () => {
    expect(playAreaRow(AREA, 0)).toEqual({ slots: [], scrolls: false });
  });
});

describe("sliceWithin", () => {
  test("a card cut by the zone's edge keeps only the part inside, and one wholly outside has none", () => {
    expect(sliceWithin({ x: 480, y: 0, width: 100, height: 10 }, AREA)).toEqual({
      x: 500,
      y: 0,
      width: 80,
      height: 10,
    });
    expect(sliceWithin({ x: 1450, y: 0, width: 100, height: 10 }, AREA)).toEqual({
      x: 1450,
      y: 0,
      width: 50,
      height: 10,
    });
    expect(sliceWithin({ x: 300, y: 0, width: 100, height: 10 }, AREA)).toBeNull();
    expect(sliceWithin({ x: 1500, y: 0, width: 100, height: 10 }, AREA)).toBeNull();
  });
});

describe("PlayAreaScroll", () => {
  const settle = (
    scroll: PlayAreaScroll,
    count: number,
    focused: InstanceId | null = null,
    targets: readonly InstanceId[] | null = null,
  ) => {
    const row = playAreaRow(AREA, count);
    scroll.settle(AREA, ids(count), row.slots, focused, targets);
    return row;
  };

  test("a resumed game opens at the start of the row, and a row that fits cannot scroll", () => {
    const scroll = new PlayAreaScroll(() => {});
    settle(scroll, 13);
    expect(scroll.row.canScroll).toBe(true);
    expect(scroll.row.scrollX).toBe(0);
    settle(scroll, 3);
    expect(scroll.row.canScroll).toBe(false);
    expect(scroll.row.scrollX).toBe(0);
  });

  test("a card that just entered play off the right edge is brought into view, without a redraw of its own", () => {
    const redraw = vi.fn();
    const scroll = new PlayAreaScroll(redraw);
    settle(scroll, 12);
    const row = settle(scroll, 13);
    const last = row.slots.at(-1)!;
    expect(last.x + last.width - scroll.row.scrollX).toBeCloseTo(AREA.x + AREA.width);
    expect(redraw).not.toHaveBeenCalled();
  });

  test("a wheel scroll is kept by the next redraw of the same cards", () => {
    const scroll = new PlayAreaScroll(() => {});
    settle(scroll, 13);
    scroll.row.scrollBy(200);
    settle(scroll, 13);
    expect(scroll.row.scrollX).toBe(200);
  });

  test("keyboard focus moving onto a card off screen scrolls to it", () => {
    const scroll = new PlayAreaScroll(() => {});
    const row = settle(scroll, 13);
    settle(scroll, 13, ids(13)[12]!);
    expect(scroll.row.scrollX).toBeCloseTo(row.slots[12]!.x + row.slots[12]!.width - (AREA.x + AREA.width));
    // Back to the first card.
    settle(scroll, 13, ids(13)[0]!);
    expect(scroll.row.scrollX).toBe(0);
  });

  test("a target prompt scrolls to its first target only when none of them is on screen", () => {
    const scroll = new PlayAreaScroll(() => {});
    settle(scroll, 13, null, [ids(13)[1]!, ids(13)[12]!]);
    expect(scroll.row.scrollX).toBe(0);
    settle(scroll, 13, null, null);
    settle(scroll, 13, null, [ids(13)[11]!, ids(13)[12]!]);
    expect(scroll.row.scrollX).toBeGreaterThan(0);
  });

  test("the wheel scrolls the row only while the pointer is over it", () => {
    const scroll = new PlayAreaScroll(() => {});
    settle(scroll, 13);
    scroll.row.onWheel({ x: 100, y: 800 }, [], 0, 120); // over the identity panel, left of the play area
    expect(scroll.row.scrollX).toBe(0);
    scroll.row.onWheel({ x: 900, y: 100 }, [], 0, 120); // above it
    expect(scroll.row.scrollX).toBe(0);
    scroll.row.onWheel({ x: 900, y: 800 }, [], 0, 120);
    expect(scroll.row.scrollX).toBe(120);
  });
});

describe("a second deck's column (Doctor Strange's Invocation)", () => {
  test("grows with the card size and with a tall zone, within its share of the width", () => {
    expect(separateColumnWidth(900, 250, 1.5)).toBeGreaterThan(separateColumnWidth(900, 250, 1));
    expect(separateColumnWidth(2500, 500, 1)).toBeGreaterThan(separateColumnWidth(2500, 200, 1));
    expect(separateColumnWidth(300, 500, 2)).toBeLessThanOrEqual(90);
  });

  test("its piles keep card proportions across the column, and never exceed the room", () => {
    expect(separateRowHeight(600, 1, 400)).toBeGreaterThan(separateRowHeight(600, 1, 150));
    expect(separateRowHeight(100, 1, 400)).toBe(100);
  });
});

describe("form cards beside the play area (issue #308)", () => {
  const within = (slot: Rect, row: Rect): boolean =>
    slot.x >= row.x - 0.5 &&
    slot.y >= row.y + FORM_ROW_HEADER - 0.5 &&
    slot.x + slot.width <= row.x + row.width + 0.5 &&
    slot.y + slot.height <= row.y + row.height + 0.5;

  test("a wide desktop row lays Spectrum's three forms side by side, at card proportions, inside the row", () => {
    const row: Rect = { x: 0, y: 0, width: 330, height: 240 };
    const slots = formCardSlots(row, 3);
    expect(new Set(slots.map((slot) => slot.y)).size).toBe(1);
    for (const slot of slots) {
      expect(within(slot, row)).toBe(true);
      expect(slot.width / slot.height).toBeCloseTo(CARD_ASPECT, 5);
    }
  });

  test("a tall narrow phone column stacks them into a grid, bigger than three across would be", () => {
    const row: Rect = { x: 0, y: 0, width: 110, height: 250 };
    const slots = formCardSlots(row, 3);
    const threeAcross = (110 - 2 * 6) / 3 / CARD_ASPECT;
    expect(slots[0]!.height).toBeGreaterThan(threeAcross);
    for (const slot of slots) expect(within(slot, row)).toBe(true);
    // No two cards overlap.
    for (const [i, a] of slots.entries()) {
      for (const b of slots.slice(i + 1)) {
        const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  test("the column never takes more than 30% of the zone, nor less than the second-deck column", () => {
    expect(formColumnWidth(1000, 240, 3)).toBe(300);
    expect(formColumnWidth(1000, 40, 3)).toBe(separateColumnWidth(1000, 40));
  });
});
