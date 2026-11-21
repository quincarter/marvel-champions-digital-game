import type { ChoiceRef, GameState, PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  MINION_FAN_SHOW,
  MINION_STRIP_GAP,
  MINION_THUMB_MAX,
  minionStripOf,
  playerRowMinions,
} from "./choice-player-minions.js";

const row = { x: 100, y: 10, width: 400, height: 52 };

describe("the minion stack on a choose-a-player row (issue #911)", () => {
  it("takes no room with no minion", () => {
    expect(minionStripOf(row, 0, 200)).toEqual({ thumbs: [], visible: [], count: 0, badge: null, width: 0 });
  });

  it("one minion: one full picture at the row's right end, no badge", () => {
    const strip = minionStripOf(row, 1, 200);
    expect(strip.thumbs).toHaveLength(1);
    expect(strip.badge).toBeNull();
    const [only] = strip.thumbs;
    expect(only!.width).toBe(MINION_THUMB_MAX);
    expect(only!.x + only!.width + MINION_STRIP_GAP).toBe(row.x + row.width);
    expect(strip.visible).toEqual(strip.thumbs);
  });

  it("several minions overlap as a fan, the last fully on top, with a count badge", () => {
    const strip = minionStripOf(row, 3, 200);
    const step = Math.round(MINION_THUMB_MAX * MINION_FAN_SHOW);
    expect(strip.count).toBe(3);
    expect(strip.thumbs.map((t) => t.x - strip.thumbs[0]!.x)).toEqual([0, step, 2 * step]);
    expect(strip.visible.slice(0, 2).every((v) => v.width === step)).toBe(true);
    expect(strip.visible[2]).toEqual(strip.thumbs[2]);
    expect(strip.width).toBe(MINION_THUMB_MAX + 2 * step + 2 * MINION_STRIP_GAP);
    expect(strip.badge).not.toBeNull();
    // The hover areas never overlap: each minion can be hovered on its own.
    for (let i = 1; i < strip.visible.length; i++) {
      expect(strip.visible[i]!.x).toBeGreaterThanOrEqual(strip.visible[i - 1]!.x + strip.visible[i - 1]!.width);
    }
  });

  it("many minions narrow their slivers to fit, never below a hoverable floor", () => {
    const strip = minionStripOf(row, 8, 120);
    expect(strip.thumbs).toHaveLength(8);
    const step = strip.thumbs[1]!.x - strip.thumbs[0]!.x;
    expect(step).toBeGreaterThanOrEqual(10);
    expect(step).toBeLessThan(Math.round(MINION_THUMB_MAX * MINION_FAN_SHOW));
  });

  it.each([
    [12, 96],
    [12, 60],
    [30, 120],
    [3, 30],
  ])("never wider than its room: %i minions in %ipx (code review, #911)", (count, maxWidth) => {
    const strip = minionStripOf(row, count, maxWidth);
    expect(strip.width).toBeLessThanOrEqual(maxWidth);
    expect(strip.count).toBe(count);
    expect(strip.thumbs.length).toBeGreaterThanOrEqual(1);
    expect(strip.thumbs.length).toBeLessThanOrEqual(count);
    const right = row.x + row.width;
    for (const t of strip.thumbs) {
      expect(t.x).toBeGreaterThanOrEqual(right - maxWidth);
      expect(t.x + t.width).toBeLessThanOrEqual(right);
    }
    for (let i = 1; i < strip.visible.length; i++) {
      expect(strip.visible[i]!.x).toBeGreaterThanOrEqual(strip.visible[i - 1]!.x + strip.visible[i - 1]!.width);
    }
    if (count > 1) expect(strip.badge).not.toBeNull();
  });

  it("lists a seat's minions for a player row, and none for any other row", () => {
    const game = {
      players: [{ playerId: "p1", playArea: ["m1", "ally", "m2"] }],
      instances: { m1: { cardId: "M" }, m2: { cardId: "M" }, ally: { cardId: "A" } },
      cardPool: { M: { type: "minion" }, A: { type: "ally" } },
    } as unknown as GameState;
    expect(playerRowMinions(game, { kind: "player", playerId: "p1" as PlayerId })).toEqual(["m1", "m2"]);
    expect(playerRowMinions(game, { kind: "none" } as unknown as ChoiceRef)).toEqual([]);
  });

  it("draws smaller pictures on a short row", () => {
    const strip = minionStripOf({ ...row, height: 36 }, 1, 200);
    expect(strip.thumbs[0]!.width).toBe(24);
  });
});
