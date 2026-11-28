// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, settle, stopKeys } from "../../shared/test-support.js";
import "../mc-pool-list.js";
import { gridMeasuresFor, type McPoolList } from "../McPoolList.js";
import type { PoolListModel } from "../mc-pool-list.types.js";
import type { PoolCardModel } from "../../mc-pool-cell/mc-pool-cell.types.js";

afterEach(() => document.body.replaceChildren());

const card = (index: number): PoolCardModel => ({
  cardId: `c${index}`,
  picture: { src: null, missing: `Card ${index}` },
  title: `Card ${index}`,
  cost: index,
  caption: "Event",
  captionStrong: false,
  typeLine: "Event",
  note: null,
  rules: "",
  quantity: 0,
  minus: { aria: "Remove", disabled: true },
  plus: { aria: "Add", disabled: null },
  face: null,
});

const model = (over: Partial<PoolListModel> = {}): PoolListModel => ({
  view: "list",
  count: 500,
  cardAt: card,
  cardScale: 1,
  rowHeight: 104,
  thumbWidth: 60,
  desktop: false,
  empty: null,
  ...over,
});

describe("gridMeasuresFor", () => {
  it("adds columns as the list widens and a copy strip to every row", () => {
    const narrow = gridMeasuresFor(400, 100, 1, false);
    const wide = gridMeasuresFor(1200, 100, 1, false);
    expect(wide.columns).toBeGreaterThan(narrow.columns);
    expect(narrow.rowHeight).toBeGreaterThan(46 + 52);
  });
});

describe("mc-pool-list", () => {
  it("builds only the rows near the top of a long list, each the card:<id> stop", async () => {
    const el = await mount<McPoolList>("mc-pool-list", { model: model() });
    const keys = stopKeys(el).filter((k) => k.startsWith("card:"));
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.length).toBeLessThan(20);
    expect(keys[0]).toBe("card:c0");
  });

  it("asks for a card only while it is built", async () => {
    const asked: number[] = [];
    await mount<McPoolList>("mc-pool-list", {
      model: model({
        cardAt: (i) => {
          asked.push(i);
          return card(i);
        },
      }),
    });
    expect(Math.max(...asked)).toBeLessThan(20);
  });

  it("says why there is nothing to list", async () => {
    const el = await mount<McPoolList>("mc-pool-list", { model: model({ count: 0, empty: "No card matches." }) });
    expect(inner(el, ".empty")!.textContent).toBe("No card matches.");
  });

  it("lists cards as a grid when the model says so, and passes a cell's events on", async () => {
    const el = await mount<McPoolList>("mc-pool-list", { model: model({ view: "grid", count: 6 }) });
    el.width = 600;
    await settle(el);
    const seen = builderEvents(el);
    inner(el, "mc-windowed-list")!.shadowRoot!.querySelector<HTMLElement>("mc-pool-cell")!.click();
    expect(seen).toEqual([{ type: "add", cardId: "c0" }]);
    expect(el.getAttribute("view")).toBe("grid");
  });
});
