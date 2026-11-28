// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-pool-search.js";
import type { McPoolSearch } from "../McPoolSearch.js";
import type { PoolSearchModel } from "../mc-pool-search.types.js";

afterEach(() => document.body.replaceChildren());

const model = (text = ""): PoolSearchModel => ({
  text,
  placeholder: "Search cards",
  clearLabel: "Clear",
  helpLabel: "Search help",
  viewLabel: "List view",
});

describe("mc-pool-search", () => {
  it("has the field, ? and view toggle as stops, and Clear only while there is text", async () => {
    const empty = await mount<McPoolSearch>("mc-pool-search", { model: model() });
    expect(stopKeys(empty)).toEqual(["filter-text", "filter-help", "pool-view"]);
    document.body.replaceChildren();
    const typed = await mount<McPoolSearch>("mc-pool-search", { model: model("spider") });
    expect(stopKeys(typed)).toEqual(["filter-text", "filter-clear", "filter-help", "pool-view"]);
  });

  it("says the accepted text, and an empty one from the clear button", async () => {
    const el = await mount<McPoolSearch>("mc-pool-search", { model: model("spider") });
    const seen = builderEvents(el);
    inner<HTMLElement>(el, "mc-search-field")!.dispatchEvent(
      new CustomEvent("mc-search", { detail: { value: "web", immediate: false }, bubbles: true, composed: true }),
    );
    press(stop(el, "filter-clear"));
    expect(seen).toEqual([
      { type: "search", text: "web" },
      { type: "search", text: "" },
    ]);
  });

  it("opens the cheat sheet and toggles the view", async () => {
    const el = await mount<McPoolSearch>("mc-pool-search", { model: model() });
    const seen = builderEvents(el);
    press(stop(el, "filter-help"));
    press(stop(el, "pool-view"));
    expect(seen).toEqual([{ type: "search-help" }, { type: "pool-view" }]);
  });
});
