import { describe, expect, test } from "vitest";
import { CARD_ASPECT } from "./layout.js";
import { missionSlots, splitMissionArea } from "./mission-area-layout.js";

const zone = { x: 10, y: 50, width: 700, height: 400 };

describe("splitMissionArea", () => {
  test("a game with no area keeps the zone whole", () => {
    expect(splitMissionArea(zone, false)).toEqual({ enemies: zone, area: null });
  });

  test("the area is the foot of the zone and the enemies keep the rest, with a gap between", () => {
    const { enemies, area } = splitMissionArea(zone, true);
    expect(area).not.toBeNull();
    expect(area!.y + area!.height).toBe(zone.y + zone.height);
    expect(enemies.y).toBe(zone.y);
    expect(enemies.y + enemies.height).toBeLessThan(area!.y);
    expect(area!.width).toBe(zone.width);
  });

  test("a short zone never gives the enemies less than a card's worth", () => {
    const { enemies, area } = splitMissionArea({ ...zone, height: 230 }, true);
    expect(enemies.height).toBeGreaterThanOrEqual(100);
    expect(area!.height).toBeGreaterThanOrEqual(80);
  });
});

describe("missionSlots", () => {
  const inner = { x: 0, y: 0, width: 600, height: 140 };

  test("a scheme takes a wider slot than a card, all one height, in order without overlap", () => {
    const [scheme, ally] = missionSlots(inner, ["scheme", "card"]);
    expect(scheme!.height).toBe(ally!.height);
    expect(scheme!.width).toBeGreaterThan(ally!.width);
    expect(ally!.x).toBeGreaterThan(scheme!.x + scheme!.width);
    expect(ally!.width / ally!.height).toBeCloseTo(CARD_ASPECT, 5);
  });

  test("too many cards shrink to fit the width instead of leaving the area", () => {
    const slots = missionSlots(inner, ["scheme", "card", "card", "card", "card", "card", "card"]);
    const last = slots[slots.length - 1]!;
    expect(last.x + last.width).toBeLessThanOrEqual(inner.x + inner.width + 0.001);
    expect(slots[0]!.height).toBeLessThan(inner.height);
  });

  test("nothing in the area is no slots", () => {
    expect(missionSlots(inner, [])).toEqual([]);
  });
});
