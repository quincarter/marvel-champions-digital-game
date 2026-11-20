import { describe, expect, it } from "vitest";
import type { ChoiceRef, GameState, PlayerId } from "@mc/engine";
import { MINION_STRIP_GAP, MINION_THUMB_MAX, minionStripOf, playerRowMinions } from "./choice-player-minions.js";

const row = { x: 100, y: 10, width: 400, height: 52 };

describe("the minion strip on a choose-a-player row (issue #911)", () => {
  it("takes no room with no minion", () => {
    expect(minionStripOf(row, 0, 200)).toEqual({ thumbs: [], more: 0, moreRect: null, width: 0 });
  });

  it("right-aligns one square per minion inside the row", () => {
    const strip = minionStripOf(row, 3, 200);
    const side = MINION_THUMB_MAX;
    expect(strip.thumbs).toHaveLength(3);
    expect(strip.more).toBe(0);
    expect(strip.thumbs.every((t) => t.width === side && t.height === side)).toBe(true);
    const last = strip.thumbs[2]!;
    expect(last.x + last.width + MINION_STRIP_GAP).toBe(row.x + row.width);
    expect(strip.thumbs[0]!.x).toBe(row.x + row.width - strip.width + MINION_STRIP_GAP);
    expect(strip.thumbs.every((t) => t.y >= row.y && t.y + t.height <= row.y + row.height)).toBe(true);
  });

  it("counts the minions it has no room for as +N", () => {
    const strip = minionStripOf(row, 6, 120);
    expect(strip.thumbs.length + strip.more).toBe(6);
    expect(strip.more).toBeGreaterThan(0);
    expect(strip.width).toBeLessThanOrEqual(120);
    expect(strip.moreRect).not.toBeNull();
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
