import { describe, expect, it } from "vitest";
import {
  ENVIRONMENT_GAP,
  ENVIRONMENT_MIN_HEIGHT,
  ENVIRONMENT_MIN_WIDTH,
  environmentSlots,
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
