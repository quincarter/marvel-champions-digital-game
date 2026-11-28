// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-decks-list-filters.js";
import type { McDecksListFilters, DecksListFiltersModel } from "../McDecksListFilters.js";
import type { DecksEvent } from "../../decks.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<DecksListFiltersModel> = {}): DecksListFiltersModel => ({
  search: { text: "hawk", placeholder: "search decks…", clearLabel: "Clear" },
  filtersLabel: "Filters",
  filtersOpen: false,
  chips: [],
  ...over,
});

async function mount(m: DecksListFiltersModel): Promise<McDecksListFilters> {
  const element = document.createElement("mc-decks-list-filters") as McDecksListFilters;
  element.model = m;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

describe("mc-decks-list-filters", () => {
  it("gives the field the text the screen took and folds the chips away while the button is shut", async () => {
    const element = await mount(model());
    const field = element.shadowRoot!.querySelector("mc-search-field") as HTMLElement & { value: string };
    expect(field.value).toBe("hawk");
    expect(field.getAttribute("data-stop")).toBe("deck-search");
    expect(element.shadowRoot!.querySelector(".chips")).toBeNull();
  });

  it("shows each chip as a stop and raises its id, and the Filters button raises its action", async () => {
    const element = await mount(
      model({ filtersOpen: true, chips: [{ id: "legal-only", label: "Legal only", selected: false }] }),
    );
    const seen: DecksEvent[] = [];
    element.addEventListener("mc-decks", (event) => seen.push((event as CustomEvent<DecksEvent>).detail));
    const chip = element.shadowRoot!.querySelector('[data-stop="deck-chip:legal-only"]')!;
    chip.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { key: "legal-only" }, bubbles: true, composed: true }),
    );
    element.shadowRoot!.querySelector<HTMLElement>('[data-stop="filters-toggle"]')!.click();
    expect(seen).toEqual([
      { type: "chip", list: "deck", id: "legal-only" },
      { type: "action", action: "filters-toggle" },
    ]);
  });
});
