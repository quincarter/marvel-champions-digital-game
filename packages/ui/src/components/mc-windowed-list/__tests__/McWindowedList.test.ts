import { html } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-windowed-list";
import { windowOf } from "../McWindowedList";
import type { WindowDetail } from "../mc-windowed-list.types";

afterEach(() => document.body.replaceChildren());

async function list(count: number, columns = 1) {
  const el = document.createElement("mc-windowed-list");
  Object.defineProperty(el, "clientHeight", { value: 300, configurable: true });
  el.count = count;
  el.rowHeight = 100;
  el.columns = columns;
  el.renderItem = (index) => html`<i data-i=${index}></i>`;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const built = (el: HTMLElement): number[] =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-i]")].map((i) => Number(i.dataset.i));

describe("windowOf", () => {
  it("builds the viewport plus two rows each side, and nothing for no rows", () => {
    expect(windowOf(100, 1000, 300, 0)).toEqual({ start: 0, end: 5 });
    expect(windowOf(100, 1000, 300, 5000)).toEqual({ start: 48, end: 55 });
    expect(windowOf(100, 3, 300, 0)).toEqual({ start: 0, end: 3 });
    expect(windowOf(100, 0, 300, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe("mc-windowed-list", () => {
  it("builds only the items near the viewport, in a space as tall as every row", async () => {
    const el = await list(1000);
    expect(built(el)).toEqual([0, 1, 2, 3, 4]);
    expect(el.shadowRoot!.querySelector<HTMLElement>(".space")!.style.height).toBe("100000px");
  });

  it("puts `columns` items on a row and rows from the item count", async () => {
    const el = await list(10, 4);
    expect(el.rows).toBe(3);
    expect(built(el)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("builds the new rows after a scroll and says so with mc-window", async () => {
    const el = await list(1000);
    const told: WindowDetail[] = [];
    el.addEventListener("mc-window", (e) => told.push(e.detail));
    el.scrollTop = 5000;
    el.dispatchEvent(new Event("scroll"));
    await el.updateComplete;
    expect(built(el)[0]).toBe(48);
    expect(told.at(-1)).toEqual({ start: 48, end: 55 });
  });

  it("scrolls an item into view and goes back to the top", async () => {
    const el = await list(1000);
    el.scrollToIndex(20);
    expect(el.scrollTop).toBe(2100 - 300);
    el.resetScroll();
    expect(el.scrollTop).toBe(0);
  });
});
