// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-mod-tabs.js";
import { hear, mount, press, stop } from "../../shared/__tests__/test-mount.js";
import type { McModTabs } from "../McModTabs.js";

const tabs = [
  { id: "all", label: "All" },
  { id: "heroes", label: "Heroes" },
  { id: "credits", label: "Credits" },
];

describe("mc-mod-tabs", () => {
  it("draws a rail whose cells are stops named tab:<id>, the chosen one marked", async () => {
    const el = await mount<McModTabs>("mc-mod-tabs", { tabs, selected: "heroes" });
    const rail = el.shadowRoot!.querySelector("mc-tab-rail")!;
    await (rail as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const cells = [...rail.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((c) => c.dataset.stop);
    expect(cells).toEqual(["tab:all", "tab:heroes", "tab:credits"]);
    expect(rail.shadowRoot!.querySelector('[data-stop="tab:heroes"]')!.getAttribute("aria-selected")).toBe("true");
    el.remove();
  });

  it("raises tab with the id of the cell that was activated", async () => {
    const el = await mount<McModTabs>("mc-mod-tabs", { tabs, selected: "all" });
    const heard = hear(el);
    el.shadowRoot!.querySelector("mc-tab-rail")!.dispatchEvent(
      new CustomEvent("mc-activate", { detail: { id: "credits", key: "tab:credits" }, bubbles: true, composed: true }),
    );
    expect(heard).toEqual([{ type: "tab", tab: "credits" }]);
    el.remove();
  });

  it("shows the finders magnifier only on a phone, on while the finders are", async () => {
    const el = await mount<McModTabs>("mc-mod-tabs", { tabs, selected: "all" });
    expect(el.shadowRoot!.querySelector("mc-search-toggle")).toBeNull();
    el.toggleShown = true;
    el.toggleOpen = true;
    await el.updateComplete;
    const toggle = stop(el, "finders-toggle");
    expect(toggle.hasAttribute("selected")).toBe(true);
    const heard = hear(el);
    press(toggle);
    expect(heard).toEqual([{ type: "toggle-finders" }]);
    el.remove();
  });
});
