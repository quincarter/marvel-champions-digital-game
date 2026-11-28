// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-pool-grid.js";
import { gridWindow } from "../pool-window.js";
import type { McDecksPoolGrid } from "../McDecksPoolGrid.js";
import type { DecksPoolCard } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const card = (index: number): DecksPoolCard => ({
  cardId: `c${index}`,
  picture: { src: null },
  title: `Card ${index}`,
  cost: null,
  caption: "Event",
  quantity: 0,
  shown: false,
});

describe("gridWindow", () => {
  it("draws the rows in view and one above and below, and none past the last", () => {
    const view = gridWindow({ count: 100, columns: 5, rowHeight: 200, top: 1000, viewHeight: 400 });
    // 20 rows; the view covers rows 5 and 6: draw rows 4 to 7 (the end is exclusive: 8).
    expect(view.firstIndex).toBe(4 * 5);
    expect(view.endIndex).toBe(8 * 5);
    expect(view.offset).toBe(4 * 200);
    expect(view.totalHeight).toBe(20 * 200);
    expect(gridWindow({ count: 7, columns: 5, rowHeight: 200, top: 0, viewHeight: 5000 }).endIndex).toBe(7);
  });
});

describe("mc-decks-pool-grid", () => {
  it("draws nothing until it has a width, then only the cards of its window", async () => {
    const grid = document.createElement("mc-decks-pool-grid") as McDecksPoolGrid;
    grid.count = 500;
    grid.cardAt = card;
    Object.defineProperty(grid, "clientWidth", { value: 640, configurable: true });
    Object.defineProperty(grid, "clientHeight", { value: 500, configurable: true });
    document.body.append(grid);
    await grid.updateComplete;
    const cells = grid.shadowRoot!.querySelectorAll("mc-decks-pool-cell");
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThan(100);
    expect(grid.geometry!.columns).toBeGreaterThan(1);
  });

  it("raises a card press with the card id", async () => {
    const grid = document.createElement("mc-decks-pool-grid") as McDecksPoolGrid;
    grid.count = 3;
    grid.cardAt = card;
    Object.defineProperty(grid, "clientWidth", { value: 640, configurable: true });
    Object.defineProperty(grid, "clientHeight", { value: 500, configurable: true });
    document.body.append(grid);
    await grid.updateComplete;
    const seen: unknown[] = [];
    grid.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent).detail));
    const cell = grid.shadowRoot!.querySelector("mc-decks-pool-cell")!;
    cell.dispatchEvent(new CustomEvent("mc-pressed", { detail: { action: "c0" }, bubbles: true, composed: true }));
    expect(seen).toEqual([{ type: "card", cardId: "c0", via: "press" }]);
  });
});
