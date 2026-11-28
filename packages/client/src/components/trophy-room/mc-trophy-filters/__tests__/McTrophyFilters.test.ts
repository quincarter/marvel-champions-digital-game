// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-trophy-filters.js";
import type { McTrophyFilters } from "../McTrophyFilters.js";
import type { TrophyFiltersModel } from "../mc-trophy-filters.types.js";

afterEach(() => document.body.replaceChildren());

const model: TrophyFiltersModel = {
  open: false,
  toggleLabel: "▸ Sort: Category ▲",
  expandLabel: "Expand all",
  toggleGlyph: undefined,
  expandGlyph: undefined,
  sorts: [
    { id: "category", label: "Category" },
    { id: "name", label: "A–Z" },
  ],
  sort: "category",
  descending: false,
  ascendingLabel: "Ascending ▲",
  descendingLabel: "Descending ▼",
};

async function mount(m: TrophyFiltersModel = model): Promise<McTrophyFilters> {
  const el = document.createElement("mc-trophy-filters");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const stops = (el: McTrophyFilters): string[] =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((node) => node.dataset.stop!);

describe("mc-trophy-filters", () => {
  it("is two buttons while folded: the Filters button and Expand all", async () => {
    const el = await mount();
    expect(stops(el)).toEqual(["filters-toggle", "expand-all"]);
    expect(el.shadowRoot!.querySelector<HTMLElement & { label: string }>(".toggle")!.label).toBe("▸ Sort: Category ▲");
  });

  it("adds a chip per sort and the two directions while open, the chosen ones selected", async () => {
    const el = await mount({ ...model, open: true, sort: "name", descending: true });
    expect(stops(el)).toEqual(["filters-toggle", "expand-all", "sort:category", "sort:name", "dir:asc", "dir:desc"]);
    const chips = [...el.shadowRoot!.querySelectorAll<HTMLElement & { selected: boolean }>("mc-chip")];
    expect(chips.map((chip) => chip.selected)).toEqual([false, true, false, true]);
  });

  it("says what each press chose", async () => {
    const el = await mount({ ...model, open: true });
    const heard = vi.fn();
    el.addEventListener("mc-trophy-room", (event) => heard((event as CustomEvent).detail));
    const press = (stop: string): void => {
      el.shadowRoot!.querySelector<HTMLElement>(`[data-stop="${stop}"]`)!.dispatchEvent(
        new CustomEvent("mc-press", { bubbles: true, composed: true }),
      );
    };
    press("filters-toggle");
    press("expand-all");
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="sort:name"]')!.click();
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="dir:desc"]')!.click();
    expect(heard.mock.calls.map((call) => call[0])).toEqual([
      { type: "filters-toggle" },
      { type: "expand-all" },
      { type: "sort", sort: "name" },
      { type: "direction", descending: true },
    ]);
  });
});
