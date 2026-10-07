import { describe, expect, test } from "vitest";
import { tuckedFanLayout } from "./environment-layout.js";
import { CARD_ASPECT } from "./layout.js";

const ROOM = { x: 100, y: 40, width: 150, height: 50 };

describe("tuckedFanLayout", () => {
  test("nothing tucked, nothing drawn", () => {
    expect(tuckedFanLayout(ROOM, 0, CARD_ASPECT)).toBeNull();
  });

  test("one card sits at the right edge of the room, its badge to the left", () => {
    const fan = tuckedFanLayout(ROOM, 1, CARD_ASPECT)!;
    expect(fan.cards).toHaveLength(1);
    expect(fan.cards[0]).toMatchObject({ height: 48, width: 34, x: 216, y: 41 });
    expect(fan.badge.x + fan.badge.width).toBeLessThan(fan.cards[0]!.x);
    expect(fan.badge.x).toBeGreaterThanOrEqual(ROOM.x);
  });

  test("three cards keep their order, overlap to fit and stay inside the room", () => {
    const fan = tuckedFanLayout(ROOM, 3, CARD_ASPECT)!;
    expect(fan.cards.map((c) => c.x)).toEqual([...fan.cards.map((c) => c.x)].sort((a, b) => a - b));
    for (const card of fan.cards) {
      expect(card.x).toBeGreaterThanOrEqual(ROOM.x + 64);
      expect(card.x + card.width).toBeLessThanOrEqual(ROOM.x + ROOM.width);
    }
    expect(fan.badge.x).toBeGreaterThanOrEqual(ROOM.x);
  });

  test("a band too short or too narrow to read a card draws none", () => {
    expect(tuckedFanLayout({ ...ROOM, height: 20 }, 1, CARD_ASPECT)).toBeNull();
    expect(tuckedFanLayout({ ...ROOM, width: 80 }, 1, CARD_ASPECT)).toBeNull();
  });
});
