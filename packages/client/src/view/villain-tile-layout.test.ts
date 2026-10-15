import { describe, expect, test } from "vitest";
import {
  VILLAIN_TEXT_MIN_WIDTH,
  VILLAIN_TILE_MIN_HEIGHT,
  VILLAIN_TILE_MIN_WIDTH,
  bindStageWords,
  villainRowPlan,
  villainRowSlotsFor,
  villainTileLayout,
} from "./villain-tile-layout.js";
import type { Rect } from "./layout.js";

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x - 0.01 &&
  inner.y >= outer.y - 0.01 &&
  inner.x + inner.width <= outer.x + outer.width + 0.01 &&
  inner.y + inner.height <= outer.y + outer.height + 0.01;

describe("villainTileLayout", () => {
  test("a narrow tall tile stacks the scan over the text, the whole card across its width", () => {
    const rect: Rect = { x: 10, y: 10, width: 100, height: 220 };
    const tile = villainTileLayout(rect);
    expect(tile.shape).toBe("stacked");
    expect(tile.art).not.toBeNull();
    expect(tile.art!.width).toBeGreaterThan(90);
    expect(tile.text.y).toBeGreaterThanOrEqual(tile.art!.y + tile.art!.height);
  });

  test("a wide tile puts the scan beside the text", () => {
    const tile = villainTileLayout({ x: 0, y: 0, width: 200, height: 120 });
    expect(tile.shape).toBe("side");
    expect(tile.art!.x + tile.art!.width).toBeLessThanOrEqual(tile.text.x);
    expect(tile.text.width).toBeGreaterThanOrEqual(VILLAIN_TEXT_MIN_WIDTH);
  });

  test("every tile a row plan produces has art, and its parts lie inside the tile", () => {
    for (const width of [300, 359, 515, 900, 1200]) {
      for (const count of [2, 3, 4, 5, 6]) {
        for (const height of [128, 220, 330]) {
          const plan = villainRowPlan(width, count, height, 400);
          for (const slot of villainRowSlotsFor({ x: 0, y: 0, width }, count, plan)) {
            const tile = villainTileLayout(slot);
            const label = `${width}x${height} x${count}`;
            expect(tile.art, label).not.toBeNull();
            expect(inside(tile.art!, slot), label).toBe(true);
            expect(inside(tile.text, slot), label).toBe(true);
            expect(inside(tile.bar, slot), label).toBe(true);
            // The text column never takes the bar's strip, and never overlaps the scan.
            expect(tile.hpLine.y + tile.hpLine.height, label).toBeLessThanOrEqual(tile.bar.y);
          }
        }
      }
    }
  });
});

describe("villainRowPlan", () => {
  test("six villains in a docked band's 495px make two rows of three, tiles that carry art", () => {
    const plan = villainRowPlan(495, 6, 220);
    expect(plan.rows).toBe(2);
    expect(plan.perRow).toBe(3);
    expect(plan.tileWidth).toBeGreaterThanOrEqual(VILLAIN_TILE_MIN_WIDTH);
    expect(villainTileLayout({ x: 0, y: 0, width: plan.tileWidth, height: plan.tileHeight }).art).not.toBeNull();
  });

  test("four villains on a phone's 366px content make a two by two grid, never four slivers", () => {
    const plan = villainRowPlan(366, 4, 128, 400);
    expect(plan).toMatchObject({ rows: 2, perRow: 2 });
    expect(plan.tileHeight).toBeGreaterThanOrEqual(VILLAIN_TILE_MIN_HEIGHT);
    expect(plan.height).toBeLessThanOrEqual(400);
  });

  test("four villains on a wide band stay in one row", () => {
    expect(villainRowPlan(800, 4, 220)).toMatchObject({ rows: 1, perRow: 4 });
  });

  test("rows grow toward the tile minimum, never past the room given", () => {
    const grown = villainRowPlan(366, 4, 128, 400);
    const capped = villainRowPlan(366, 4, 128, 200);
    expect(grown.height).toBeGreaterThan(128);
    expect(capped.height).toBeLessThanOrEqual(200 + 0.01);
  });

  test("a larger Card size makes taller tiles in the same width", () => {
    expect(villainRowPlan(800, 4, 330).tileHeight).toBeGreaterThan(villainRowPlan(800, 4, 220).tileHeight);
  });

  test("a short last row is centred and no slot leaves the band", () => {
    const band: Rect = { x: 20, y: 5, width: 500, height: 230 };
    const plan = villainRowPlan(band.width, 5, band.height);
    const slots = villainRowSlotsFor(band, 5, plan);
    expect(slots).toHaveLength(5);
    for (const slot of slots) expect(inside(slot, band)).toBe(true);
  });
});

describe("bindStageWords", () => {
  test("joins the stage word to its numeral, so a wrap cannot put them on different lines", () => {
    expect(bindStageWords("Villain · Stage I")).toBe("Villain · Stage I");
    expect(bindStageWords("Villain · Side A · Victory 1/3")).toBe("Villain · Side A · Victory 1/3");
  });

  test("leaves a subtitle with no stage alone", () => {
    expect(bindStageWords("Minion · Hydra")).toBe("Minion · Hydra");
  });
});
