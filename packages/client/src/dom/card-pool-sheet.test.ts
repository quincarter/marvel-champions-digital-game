import { describe, expect, it } from "vitest";
import { drawCardPool, poolWindowKey, POOL_GRID_CONTROLS_HEIGHT } from "./card-pool-sheet.js";
import type { CardPoolCard } from "./card-pool-sheet.types.js";
import { SheetBuilder } from "./sheet-builder.js";
import { poolGridGeometry } from "../view/deck-pool-grid.js";

const builder = (): SheetBuilder => new SheetBuilder({} as never, { x: 0, y: 0 }, () => false);

const card = (id: string, over: Partial<CardPoolCard> = {}): CardPoolCard => ({
  cardId: id,
  imageUrl: `/art/${id}.png`,
  missing: id,
  title: `Card ${id}`,
  cost: 2,
  caption: "Event",
  captionStrong: false,
  typeLine: "Event · Justice",
  note: null,
  rules: "Deal 2 damage.",
  quantity: 0,
  ...over,
});

describe("poolWindowKey", () => {
  it("is the rows in view plus two above and below, with the row count, and empty with nothing to draw", () => {
    expect(poolWindowKey(100, 50, 300, 0)).toBe("0-5-50");
    expect(poolWindowKey(100, 50, 300, 1000)).toBe("8-15-50");
    expect(poolWindowKey(100, 6, 300, 400)).toBe("2-6-6");
    expect(poolWindowKey(0, 10, 300, 0)).toBe("");
    expect(poolWindowKey(100, 0, 300, 0)).toBe("");
  });
});

describe("drawCardPool", () => {
  const rect = { x: 10, y: 20, width: 400, height: 300 };

  it("draws only the rows in the window of a grid, finds each cell, and keys the parts by card", () => {
    const geometry = {
      ...poolGridGeometry(rect.width, 100, false, 1, 20),
    };
    const withStrip = { ...geometry, cellHeight: geometry.cellHeight + POOL_GRID_CONTROLS_HEIGHT };
    const asked: number[] = [];
    const b = builder();
    const layout = drawCardPool(b, {
      key: "list:pool",
      rect,
      view: "grid",
      count: 100,
      geometry: withStrip,
      listRow: { height: 100, thumbWidth: 50 },
      scrollTop: 0,
      cardAt: (i) => {
        asked.push(i);
        return card(`c${i}`, {
          quantity: i === 0 ? 2 : 0,
          controls: { minus: { aria: "Remove" }, plus: { aria: "Add" } },
        });
      },
    });
    expect(layout.rowCount).toBe(withStrip.rows);
    expect(layout.window.startsWith("0-")).toBe(true);
    const [, end] = layout.window.split("-").map(Number);
    expect(asked.length).toBe(Math.min(100, end! * withStrip.columns));
    const scroll = b.nodes.find((n) => n.kind === "scroll");
    expect(scroll).toMatchObject({ kind: "scroll", key: "list:pool" });
    const inner = scroll?.kind === "scroll" ? scroll.nodes : [];
    const keys = inner.flatMap((n) => ("key" in n && n.key ? [n.key] : []));
    expect(keys).toEqual(
      expect.arrayContaining([
        "cell:c0",
        "art:c0",
        "name:c0",
        "caption:c0",
        "open:c0",
        "minus:c0",
        "plus:c0",
        "qty:c0",
      ]),
    );
    // A card with copies in the deck is framed in red.
    expect(inner.find((n) => n.kind === "box" && n.key === "cell:c0")).toMatchObject({ strokeWidth: 4 });
    expect(inner.find((n) => n.kind === "box" && n.key === "cell:c1")).toMatchObject({ strokeWidth: 2 });
    // The face (hover and tap area) leaves out the quantity strip.
    expect(layout.faceRect(0).height).toBe(withStrip.cellHeight - POOL_GRID_CONTROLS_HEIGHT - 4);
  });

  it("draws list rows with the type line, note and rules, and no controls when there are none", () => {
    const b = builder();
    const layout = drawCardPool(b, {
      key: "list:pool",
      rect,
      view: "list",
      count: 3,
      geometry: null,
      listRow: { height: 90, thumbWidth: 50 },
      scrollTop: 0,
      cardAt: (i) => card(`r${i}`, { note: i === 0 ? "Hero card" : null }),
    });
    expect(layout.rowHeight).toBe(90);
    expect(layout.cellRect(2)).toMatchObject({ y: 180, height: 90 });
    const scroll = b.nodes.find((n) => n.kind === "scroll");
    const inner = scroll?.kind === "scroll" ? scroll.nodes : [];
    const keys = inner.flatMap((n) => ("key" in n && n.key ? [n.key] : []));
    expect(keys).toEqual(expect.arrayContaining(["row:r0", "type:r0", "note:r0", "rules:r0", "open:r0"]));
    expect(keys).not.toContain("note:r1");
    expect(keys).not.toContain("plus:r0");
    // The list has its own frame outside the scroller.
    expect(b.nodes[0]).toMatchObject({ kind: "box", stroke: expect.any(String) });
  });

  it("draws nothing for an empty pool", () => {
    const b = builder();
    const layout = drawCardPool(b, {
      key: "list:pool",
      rect,
      view: "list",
      count: 0,
      geometry: null,
      listRow: { height: 90, thumbWidth: 50 },
      scrollTop: 0,
      cardAt: () => card("x"),
    });
    expect(layout.window).toBe("");
    expect(b.nodes).toEqual([]);
  });
});
