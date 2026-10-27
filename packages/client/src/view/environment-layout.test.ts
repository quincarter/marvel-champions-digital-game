import { describe, expect, it } from "vitest";
import {
  ENVIRONMENT_GAP,
  ENVIRONMENT_MIN_HEIGHT,
  ENVIRONMENT_MIN_WIDTH,
  ENVIRONMENT_ATTACHMENT_STRIP,
  compactCounterWidth,
  environmentAttachmentStrips,
  environmentCompactLayout,
  environmentSlots,
  environmentStripRoom,
  MINION_BESIDE_TILE_MAX,
  minionRoomBesideEnvironments,
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

describe("environmentCompactLayout, a two-line name", () => {
  const tile = { x: 0, y: 0, width: 150, height: 80 };

  it("grows the title band into what the counters leave, and the chips stay clear of it", () => {
    const one = environmentCompactLayout(tile, ["secret"], false);
    const two = environmentCompactLayout(tile, ["secret"], false, 30);
    expect(two.title.height).toBeGreaterThan(one.title.height);
    expect(two.title.height).toBe(30);
    expect(rectsOverlap(two.title, two.counters[0]!)).toBe(false);
  });

  it("never takes more than the counters leave", () => {
    const layout = environmentCompactLayout({ ...tile, height: 56 }, ["secret"], false, 60);
    expect(rectsOverlap(layout.title, layout.counters[0]!)).toBe(false);
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

describe("minionRoomBesideEnvironments", () => {
  const zone: Rect = { x: 455, y: 62, width: 811, height: 283 };
  const slots = environmentSlots({ x: 757, y: 72, width: 200, height: 142 }, 1);

  it("is the free space right of the environments, the zone's full height", () => {
    const room = minionRoomBesideEnvironments(zone, slots, 90)!;
    expect(room.x).toBeGreaterThanOrEqual(slots[0]!.x + slots[0]!.width);
    expect(room.x + room.width).toBe(zone.x + zone.width - 10);
    expect(room.y).toBe(zone.y + 10);
    expect(room.height).toBe(zone.height - 20);
    expect(rectsOverlap(room, slots[0]!)).toBe(false);
  });

  it("seats two held minions at a tile as tall as the zone allows, up to the cap, where the row under the band gave 112", () => {
    const room = minionRoomBesideEnvironments(zone, slots, 90)!;
    const tile = (count: number): number => {
      const width = (room.width - 8 * (count - 1)) / count;
      return Math.min(MINION_BESIDE_TILE_MAX, room.height, width / (5 / 7));
    };
    expect(tile(1)).toBe(MINION_BESIDE_TILE_MAX);
    expect(tile(2)).toBeGreaterThan(112);
    expect(tile(4)).toBeLessThanOrEqual(112);
  });

  it("is null when less than the minimum width is left (1024 wide) or no environment is drawn", () => {
    const narrow: Rect = { x: 325, y: 57, width: 562, height: 237 };
    const tight = environmentSlots({ x: 625, y: 67, width: 170, height: 130 }, 1);
    expect(minionRoomBesideEnvironments(narrow, tight, 90)).toBeNull();
    expect(minionRoomBesideEnvironments(zone, [], 90)).toBeNull();
  });

  it("starts right of the widest of several environment tiles", () => {
    const two = environmentSlots({ x: 757, y: 72, width: 400, height: 142 }, 2);
    const room = minionRoomBesideEnvironments(zone, two, 90);
    const right = Math.max(...two.map((slot) => slot.x + slot.width));
    expect(room === null || room.x > right).toBe(true);
  });
});

describe("environmentAttachmentStrips (issue #462)", () => {
  it("stacks one strip per attachment up from the room's foot, inside it and none overlapping", () => {
    const room: Rect = { x: 10, y: 40, width: 160, height: 80 };
    const strips = environmentAttachmentStrips(room, 2);
    expect(strips).toHaveLength(2);
    expect(strips.every((strip) => inside(strip, room))).toBe(true);
    expect(rectsOverlap(strips[0]!, strips[1]!)).toBe(false);
    expect(strips[1]!.y + strips[1]!.height).toBe(room.y + room.height);
    expect(strips[0]!.height).toBe(ENVIRONMENT_ATTACHMENT_STRIP);
  });

  it("gives more attachments than strips one last strip for the rest", () => {
    expect(environmentAttachmentStrips({ x: 0, y: 0, width: 160, height: 80 }, 5)).toHaveLength(2);
    expect(environmentAttachmentStrips({ x: 0, y: 0, width: 160, height: 20 }, 3)).toHaveLength(1);
  });

  it("never leaves an attachment off: a band too short for a strip still gets one", () => {
    const strips = environmentAttachmentStrips({ x: 0, y: 50, width: 120, height: 4 }, 1);
    expect(strips).toHaveLength(1);
    expect(strips[0]!.height).toBeGreaterThanOrEqual(14);
  });

  it("draws nothing with nothing attached", () => {
    expect(environmentAttachmentStrips({ x: 0, y: 0, width: 160, height: 80 }, 0)).toEqual([]);
  });
});
