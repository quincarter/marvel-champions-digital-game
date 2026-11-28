// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-mod-finders.js";
import { hear, mount, press, stop } from "../../shared/__tests__/test-mount.js";
import type { McModFinders } from "../McModFinders.js";

const props = {
  search: { value: "", placeholder: "Search packs", clearLabel: "Clear the search" },
  sortLabel: "⇅ A to Z",
  chips: [
    { id: "tag:hero", label: "hero", count: 3, selected: false, mark: true },
    { id: "tag:spidey", label: "spidey", count: 1, selected: true, mark: true },
  ],
  clearLabel: "Clear",
  countText: "1 of 3 packs",
};

describe("mc-mod-finders", () => {
  it("offers the search box, sort and Clear as stops with the keys the pad route knows", async () => {
    const el = await mount<McModFinders>("mc-mod-finders", props);
    expect(stop(el, "search").tagName).toBe("MC-SEARCH-FIELD");
    expect(stop(el, "sort").getAttribute("data-key")).toBe("sort");
    expect(stop(el, "chip:clear").getAttribute("data-key")).toBe("chip:clear");
    expect(el.searchField).toBe(stop(el, "search"));
    expect(el.shadowRoot!.querySelector(".count")!.textContent).toBe("1 of 3 packs");
    el.remove();
  });

  it("makes each chip a stop (chip:<id>) and raises chip with the id when one is activated", async () => {
    const el = await mount<McModFinders>("mc-mod-finders", props);
    const bar = el.shadowRoot!.querySelector("mc-filter-bar")!;
    await (bar as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const stops = [...bar.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((c) => c.dataset.stop);
    expect(stops).toEqual(["chip:tag:hero", "chip:tag:spidey"]);
    const heard = hear(el);
    bar.dispatchEvent(
      new CustomEvent("mc-activate", {
        detail: { key: "chip:tag:hero", id: "tag:hero" },
        bubbles: true,
        composed: true,
      }),
    );
    expect(heard).toEqual([{ type: "chip", id: "tag:hero" }]);
    el.remove();
  });

  it("raises sort and clear from their buttons, and shows no Clear while nothing narrows the list", async () => {
    const el = await mount<McModFinders>("mc-mod-finders", props);
    const heard = hear(el);
    press(stop(el, "sort"));
    press(stop(el, "chip:clear"));
    expect(heard).toEqual([{ type: "sort" }, { type: "clear" }]);
    el.clearLabel = "";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-stop="chip:clear"]')).toBeNull();
    el.remove();
  });

  it("lets the search box's own mc-search through untouched", async () => {
    const el = await mount<McModFinders>("mc-mod-finders", props);
    let value = "";
    el.addEventListener("mc-search", (event) => (value = (event as CustomEvent<{ value: string }>).detail.value));
    stop(el, "search").dispatchEvent(
      new CustomEvent("mc-search", { detail: { value: "wolv" }, bubbles: true, composed: true }),
    );
    expect(value).toBe("wolv");
    el.remove();
  });
});
