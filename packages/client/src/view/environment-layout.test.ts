import { describe, expect, it } from "vitest";
import {
  ENVIRONMENT_GAP,
  ENVIRONMENT_MIN_HEIGHT,
  ENVIRONMENT_MIN_WIDTH,
  compactCounterWidth,
  environmentCompactLayout,
  environmentSlots,
  environmentStripRoom,
  isCompactEnvironment,
} from "./environment-layout.js";
import { rectsOverlap, type Rect } from "./layout.js";

const inside = (slot: Rect, room: Rect): boolean =>
  slot.x >= room.x - 1e-6 &&
  slot.y >= room.y - 1e-6 &&
  slot.x + slot.width <= room.x + room.width + 1e-6 &&
  slot.y + slot.height <= room.y + room.height + 1e-6;

describe("environmentSlots", () => {
  it("draws every environment inside the room, none overlapping, at every room size and count", () => {
    for (const width of [60, 110, 200, 260, 350, 460, 700]) {
      for (const height of [48, 80, 128, 200, 260]) {
        for (const count of [1, 2, 3, 4, 5]) {
          const room = { x: 10, y: 20, width, height };
          const slots = environmentSlots(room, count);
          expect(slots).toHaveLength(count);
          slots.forEach((slot, i) => {
            expect(inside(slot, room), `${count} in ${width}x${height}`).toBe(true);
            slots.slice(i + 1).forEach((other) => expect(rectsOverlap(slot, other)).toBe(false));
          });
        }
      }
    }
  });

  it("keeps one row at full height while the tiles stay at the minimum width", () => {
    const slots = environmentSlots({ x: 0, y: 0, width: 460, height: 128 }, 3);
    expect(new Set(slots.map((s) => s.y)).size).toBe(1);
    expect(slots[0]!.height).toBe(128);
    expect(slots[0]!.width).toBeGreaterThanOrEqual(ENVIRONMENT_MIN_WIDTH);
  });

  it("wraps into a second row when a third tile would be narrower than the minimum", () => {
    const room = { x: 0, y: 0, width: 300, height: 260 };
    const slots = environmentSlots(room, 3);
    expect(new Set(slots.map((s) => s.y)).size).toBe(2);
    expect(slots[0]!.width).toBeGreaterThanOrEqual(ENVIRONMENT_MIN_WIDTH);
    expect(slots[0]!.height).toBeGreaterThanOrEqual(ENVIRONMENT_MIN_HEIGHT);
    expect(slots[1]!.x - (slots[0]!.x + slots[0]!.width)).toBe(ENVIRONMENT_GAP);
  });

  it("shrinks rather than drops when the room is too small for the preferred size", () => {
    const slots = environmentSlots({ x: 0, y: 0, width: 200, height: 128 }, 3);
    expect(slots).toHaveLength(3);
  });

  it("returns nothing for no environments or no room", () => {
    expect(environmentSlots({ x: 0, y: 0, width: 400, height: 128 }, 0)).toEqual([]);
    expect(environmentSlots({ x: 0, y: 0, width: 0, height: 128 }, 2)).toEqual([]);
  });
});

describe("environmentCompactLayout", () => {
  const tile: Rect = { x: 10, y: 20, width: 170, height: 60 };

  it("stacks the title band over the counter chips without overlap, inside the tile", () => {
    for (const height of [60, 72, 95]) {
      for (const counters of [[], ["infamy"], ["infamy", "madness"]]) {
        const t = { ...tile, height };
        const layout = environmentCompactLayout(t, counters, false);
        expect(inside(layout.title, t)).toBe(true);
        for (const chip of layout.counters) {
          expect(inside(chip, t)).toBe(true);
          expect(rectsOverlap(chip, layout.title), `${counters.length} counters at ${height}`).toBe(false);
        }
        layout.counters.forEach((chip, i) =>
          layout.counters.slice(i + 1).forEach((other) => expect(rectsOverlap(chip, other)).toBe(false)),
        );
      }
    }
  });

  it("lays one chip per counter kind, at most two", () => {
    expect(environmentCompactLayout(tile, [], false).counters).toHaveLength(0);
    expect(environmentCompactLayout(tile, ["infamy"], false).counters).toHaveLength(1);
    expect(environmentCompactLayout(tile, ["a", "b", "c"], false).counters).toHaveLength(2);
  });

  it("gives a usable ability its own tag beside the title, not over it", () => {
    const layout = environmentCompactLayout(tile, ["infamy"], true);
    expect(layout.ability).not.toBeNull();
    expect(rectsOverlap(layout.ability!, layout.title)).toBe(false);
    expect(environmentCompactLayout(tile, ["infamy"], false).ability).toBeNull();
  });

  it("stacks two counters whose names do not both fit beside each other, so none is cut short", () => {
    const stacked = environmentCompactLayout(tile, ["infamy", "madness"], false).counters;
    expect(stacked[0]!.y).toBeLessThan(stacked[1]!.y);
    expect(stacked[0]!.width).toBe(stacked[1]!.width);
    for (const [chip, name] of [
      [stacked[0]!, "infamy"],
      [stacked[1]!, "madness"],
    ] as const) {
      expect(chip.width).toBeGreaterThanOrEqual(compactCounterWidth(name));
    }
    const wide = environmentCompactLayout({ ...tile, width: 400 }, ["infamy", "madness"], false).counters;
    expect(wide[0]!.y).toBe(wide[1]!.y);
  });

  it("calls a tile compact only when it is too short for the full layout", () => {
    expect(isCompactEnvironment({ ...tile, height: 60 })).toBe(true);
    expect(isCompactEnvironment({ ...tile, height: 128 })).toBe(false);
  });
});

describe("environmentStripRoom", () => {
  it("grows taller, never narrower, so every environment gets a slot at least the minimum size", () => {
    for (const width of [350, 460, 700, 1000]) {
      for (const count of [1, 2, 3, 4, 5, 6]) {
        const room = environmentStripRoom({ x: 0, y: 0 }, width, count);
        const slots = environmentSlots(room, count);
        expect(slots).toHaveLength(count);
        for (const slot of slots) {
          expect(slot.width).toBeGreaterThanOrEqual(ENVIRONMENT_MIN_WIDTH);
          expect(slot.height).toBeGreaterThanOrEqual(ENVIRONMENT_MIN_HEIGHT);
        }
      }
    }
  });
});
