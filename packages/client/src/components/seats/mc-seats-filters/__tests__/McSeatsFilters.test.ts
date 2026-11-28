// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import { settle, stop, stopKeys as keysOf, tap } from "./kit.js";
import "../mc-seats-filters.js";
import type { McSeatsFilters } from "../McSeatsFilters.js";
import type { SeatsEvent, SeatsFiltersModel } from "../../seats.types.js";

afterEach(() => document.body.replaceChildren());

const justice = {
  id: "aspect:justice",
  label: "Justice",
  selected: false,
  count: 4,
  info: { open: false, label: "About Justice" },
};

const model = (over: Partial<SeatsFiltersModel> = {}): SeatsFiltersModel => ({
  searchToggle: null,
  filtersButton: null,
  search: { visible: true, text: "", placeholder: "search heroes" },
  chips: [justice, { id: "source:precon", label: "Preconstructed", selected: true }],
  rail: false,
  buttons: [
    { action: "random", label: "Random", disabled: null, selected: false },
    { action: "game-art", label: "Game art", disabled: null, selected: true },
    { action: "preconstructed", label: "Use preconstructed", disabled: null, selected: false },
  ],
  tip: null,
  tipChipId: null,
  ...over,
});

async function mount(m: SeatsFiltersModel): Promise<{ element: McSeatsFilters; seen: SeatsEvent[] }> {
  const element = document.createElement("mc-seats-filters") as McSeatsFilters;
  const seen: SeatsEvent[] = [];
  element.addEventListener("mc-seats", (event) => seen.push((event as CustomEvent<SeatsEvent>).detail));
  element.model = m;
  document.body.append(element);
  await settle(element);
  return { element, seen };
}

const stopKeys = (element: McSeatsFilters): string[] => keysOf(element);

describe("mc-seats-filters", () => {
  it("names every part of a wide row by the stop keys the specs and the pad route use", async () => {
    const { element } = await mount(model());
    expect(stopKeys(element)).toEqual([
      "hero-search",
      "hero-random",
      "hero-art",
      "preconstructed",
      "hero-chip:aspect:justice",
      "hero-chip-info:justice",
      "hero-chip:source:precon",
    ]);
  });

  it("adds the search toggle and the Filters button on a narrow row, and hides a shut field", async () => {
    const { element } = await mount(
      model({
        searchToggle: { label: "Search heroes", open: false },
        filtersButton: { label: "Filters (1) ▾", open: true },
        search: { visible: false, text: "", placeholder: "" },
      }),
    );
    expect(stopKeys(element).slice(0, 2)).toEqual(["hero-search-toggle", "filters-toggle"]);
    expect(stopKeys(element)).not.toContain("hero-search");
    const loupe = element.shadowRoot!.querySelector(".loupe")!;
    expect(loupe.getAttribute("aria-label")).toBe("Search heroes");
    expect(loupe.getAttribute("aria-pressed")).toBe("false");
  });

  it("raises one typed event per press: toggles, chips, the i, buttons", async () => {
    const { element, seen } = await mount(
      model({
        searchToggle: { label: "Search heroes", open: false },
        filtersButton: { label: "Filters", open: false },
      }),
    );
    stop(element, "hero-search-toggle").click();
    stop(element, "filters-toggle").click();
    stop(element, "hero-chip:source:precon").click();
    stop(element, "hero-chip-info:justice").click();
    stop(element, "hero-random").click();
    stop(element, "hero-art").click();
    stop(element, "preconstructed").click();
    expect(seen).toEqual([
      { type: "toggle", what: "search" },
      { type: "toggle", what: "filters" },
      { type: "chip", id: "source:precon" },
      { type: "chip-info", id: "aspect:justice" },
      { type: "action", action: "random" },
      { type: "action", action: "game-art" },
      { type: "action", action: "preconstructed" },
    ]);
  });

  it("raises the search text from the field", async () => {
    const { element, seen } = await mount(model());
    stop(element, "hero-search").dispatchEvent(
      new CustomEvent("mc-search", { detail: { value: "spider", immediate: false }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([{ type: "search", text: "spider" }]);
  });

  it("still raises a dimmed button's press, with the reason as its tooltip", async () => {
    const { element, seen } = await mount(
      model({ buttons: [{ action: "random", label: "Random", disabled: "No other hero fits.", selected: false }] }),
    );
    const button = stop(element, "hero-random");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect((button as unknown as { reason: string }).reason).toBe("No other hero fits.");
    button.click();
    expect(seen).toEqual([{ type: "action", action: "random" }]);
  });

  describe("an open aspect tip", () => {
    const tip = {
      aspect: "justice" as const,
      title: "Justice",
      tagline: "Thwarting",
      tipLine: "Pick it when the villain schemes fast.",
      linkLabel: "Aspects ▸",
      linkAvailable: true,
      linkReason: null,
    };

    it("is drawn as the plate over the row, with its link as a stop", async () => {
      const { element } = await mount(model({ tip, tipChipId: "aspect:justice" }));
      const plate = element.shadowRoot!.querySelector("mc-tip-plate")!;
      expect(plate.shadowRoot!.querySelector(".heading")!.textContent).toBe("Justice");
      expect(stopKeys(element)).toContain("aspect-tip-link");
      expect(element.anchor).toBe(stop(element, "hero-chip-info:justice"));
    });

    it("raises the lesson link, and shuts on a tap anywhere else without pressing what is beneath", async () => {
      const { element, seen } = await mount(model({ tip, tipChipId: "aspect:justice" }));
      stop(element, "aspect-tip-link").click();
      const plate = element.shadowRoot!.querySelector("mc-tip-plate")!;
      tap(plate.shadowRoot!.querySelector(".backdrop")!);
      expect(seen).toEqual([{ type: "tip-link" }, { type: "chip-info", id: "aspect:justice" }]);
    });

    it("is not there with no tip", async () => {
      const { element } = await mount(model());
      expect(element.shadowRoot!.querySelector("mc-tip-plate")).toBeNull();
    });
  });
});
