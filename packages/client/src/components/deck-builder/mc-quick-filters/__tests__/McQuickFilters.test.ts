// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-quick-filters.js";
import type { McQuickFilters } from "../McQuickFilters.js";
import type { QuickFiltersModel } from "../mc-quick-filters.types.js";

afterEach(() => document.body.replaceChildren());

const model: QuickFiltersModel = {
  label: "Quick",
  costs: [
    { id: "cost:0", text: "0", on: false },
    { id: "cost:5", text: "5+", on: true },
  ],
  icons: [{ id: "icon:physical", text: "Physical", on: false }],
  trait: { name: "All traits", on: false },
};

describe("mc-quick-filters", () => {
  it("names the chips and the trait stepper's three parts by the stop keys the specs use", async () => {
    const el = await mount<McQuickFilters>("mc-quick-filters", { model });
    expect(stopKeys(el)).toEqual([
      "quick:cost:0",
      "quick:cost:5",
      "quick:icon:physical",
      "trait:prev",
      "trait:name",
      "trait:next",
    ]);
    expect(stop(el, "quick:cost:5").hasAttribute("selected")).toBe(true);
  });

  it("says which chip was pressed and which way the trait stepped", async () => {
    const el = await mount<McQuickFilters>("mc-quick-filters", { model });
    const seen = builderEvents(el);
    press(stop(el, "quick:icon:physical"));
    press(stop(el, "trait:prev"));
    press(stop(el, "trait:next"));
    press(stop(el, "trait:name"));
    expect(seen).toEqual([
      { type: "quick", id: "icon:physical" },
      { type: "trait", dir: -1 },
      { type: "trait", dir: 1 },
      { type: "trait", dir: 1 },
    ]);
  });
});
