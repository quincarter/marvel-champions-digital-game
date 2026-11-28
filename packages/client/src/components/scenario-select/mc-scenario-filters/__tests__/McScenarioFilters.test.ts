// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, press, selectEvents } from "../../test-support.js";
import "../mc-scenario-filters.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Record<string, unknown> = {}) => ({
  searchValue: "",
  placeholder: "Search",
  clearLabel: "Clear",
  searchShown: true,
  searchToggle: null,
  filtersButton: null,
  inspectHint: null,
  chipsShown: true,
  chips: [{ id: "product:core", label: "Core Set", selected: false }],
  ...over,
});
const stops = (el: Element): string[] =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((node) => node.dataset.stop!);

describe("mc-scenario-filters", () => {
  it("a wide screen draws the field always, then the chips", async () => {
    const el = await mount("mc-scenario-filters", { wide: true, model: model() });
    expect(stops(el)).toEqual(["scenario-search", "scenario-search-toggle"].slice(0, 1));
    expect(inner(el, "mc-scenario-chips")).not.toBeNull();
  });

  it("a narrow screen has the toggle ahead of the field, the Filters button then the chips, in focus order", async () => {
    const el = await mount("mc-scenario-filters", {
      model: model({
        searchToggle: { label: "Search", active: true },
        filtersButton: { label: "Filters", glyph: null },
      }),
    });
    expect(stops(el)).toEqual(["scenario-search-toggle", "scenario-search", "filters-toggle"]);
  });

  it("folds the chips away with chipsShown off, and hides the field with searchShown off", async () => {
    const el = await mount("mc-scenario-filters", { model: model({ chipsShown: false, searchShown: false }) });
    expect(inner(el, "mc-scenario-chips")).toBeNull();
    expect(inner(el, "mc-search-field")).toBeNull();
  });

  it("raises a press from the toggle and the Filters button, and a search with the typed text", async () => {
    const el = await mount("mc-scenario-filters", {
      model: model({
        searchToggle: { label: "Search", active: false },
        filtersButton: { label: "Filters", glyph: null },
      }),
    });
    const seen = selectEvents(el);
    press(inner(el, "mc-search-toggle")!);
    press(inner(el, "mc-hint-button")!);
    const field = inner<HTMLElement>(el, "mc-search-field")!;
    field.dispatchEvent(
      new CustomEvent("mc-search", { detail: { value: "rhino", immediate: true }, bubbles: true, composed: true }),
    );
    expect(seen).toEqual([
      { type: "press", key: "scenario-search-toggle" },
      { type: "press", key: "filters-toggle" },
      { type: "search", value: "rhino" },
    ]);
  });
});
