// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-unlocks-page.js";
import type { McUnlocksPage } from "../McUnlocksPage.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McUnlocksPage> {
  const el = document.createElement("mc-unlocks-page");
  el.model = {
    phone: false,
    bar: { title: "Unlocks", backLabel: "Back", backGlyph: null, titleDrop: 0, titleMaxRight: 0 },
    door: { label: "How it works", glyph: null },
    guide: false,
    points: { title: "3 points", detail: "Earn more" },
    all: { title: "All", detail: "d", state: "OFF", on: false },
    printAndPlay: { title: "PnP", detail: "d", state: "OFF", on: false },
    rows: [],
    sections: [{ heading: "H", paragraphs: [], bullets: [] }],
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-unlocks-page", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    for (const tag of ["mc-top-bar", "mc-unlocks-points", "mc-unlocks-switches", "mc-unlocks-list"])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(root.querySelector("mc-unlocks-guide")).toBeNull();
    expect(root.querySelector("mc-hint-button")!.getAttribute("slot")).toBe("end");
  });

  it("swaps the switches for the guide, and the door press is not Back", async () => {
    const el = await mount();
    el.model = { ...el.model!, guide: true };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-unlocks-guide")).not.toBeNull();
    expect(el.shadowRoot!.querySelector("mc-unlocks-list")).toBeNull();
    const heard = vi.fn();
    el.addEventListener("mc-unlocks", (event) => heard((event as CustomEvent).detail));
    el.shadowRoot!.querySelector("mc-hint-button")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard.mock.calls).toEqual([[{ type: "guide" }]]);
  });
});
