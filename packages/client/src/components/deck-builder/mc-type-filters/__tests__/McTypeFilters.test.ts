// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-type-filters.js";
import type { McTypeFilters } from "../McTypeFilters.js";

afterEach(() => document.body.replaceChildren());

const model = {
  label: "Filter",
  chips: [
    { id: "all", label: "All", selected: true },
    { id: "ally", label: "Ally", selected: false },
  ],
};

describe("mc-type-filters", () => {
  it("names each chip type:<id> and marks the chosen one", async () => {
    const el = await mount<McTypeFilters>("mc-type-filters", { model });
    expect(stopKeys(el)).toEqual(["type:all", "type:ally"]);
    expect(stop(el, "type:all").hasAttribute("selected")).toBe(true);
    expect(stop(el, "type:ally").hasAttribute("selected")).toBe(false);
  });

  it("says which type was pressed", async () => {
    const el = await mount<McTypeFilters>("mc-type-filters", { model });
    const seen = builderEvents(el);
    press(stop(el, "type:ally"));
    expect(seen).toEqual([{ type: "type-filter", id: "ally" }]);
  });
});
