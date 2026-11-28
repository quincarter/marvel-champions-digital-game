// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-controls-page.js";
import type { McControlsPage } from "../McControlsPage.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McControlsPage> {
  const el = document.createElement("mc-controls-page");
  el.model = {
    phone: false,
    bar: { title: "Controls", backLabel: "Back", backGlyph: null },
    tabs: [{ id: "controller", label: "Controller" }, { id: "keyboard", label: "Keyboard" }],
    tab: "keyboard",
    status: { connected: false, text: "No controller connected" },
    diagram: null,
    settings: [],
    sections: [{ id: "s", title: "Keys", rows: [] }],
    footer: { labels: ["Remap keys"], reason: "Coming soon" },
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-controls-page", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-tab-rail", "mc-controls-status", "mc-controls-settings", "mc-controls-list"]) expect(root.querySelector(tag), tag).not.toBeNull();
    expect(root.querySelector("mc-controls-diagram")).toBeNull();
    expect(root.querySelector("mc-button")!.hasAttribute("disabled")).toBe(true);
    expect(el.scroller).not.toBeNull();
  });

  it("says back from the bar and tab from the rail", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-controls", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    el.shadowRoot!.querySelector("mc-tab-rail")!.dispatchEvent(new CustomEvent("mc-activate", { detail: { key: "tab:controller", id: "controller" }, bubbles: true, composed: true }));
    expect(heard.mock.calls).toEqual([[{ type: "back" }], [{ type: "tab", id: "controller" }]]);
  });
});
