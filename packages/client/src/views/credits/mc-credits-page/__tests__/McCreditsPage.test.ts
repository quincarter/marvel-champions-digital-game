// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-credits-page.js";
import type { McCreditsPage } from "../McCreditsPage.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McCreditsPage> {
  const el = document.createElement("mc-credits-page");
  el.model = {
    phone: false,
    bar: { title: "Art & Credits", backLabel: "Back", backGlyph: null },
    rows: [
      { kind: "notice", text: "Fan project" },
      { kind: "section", title: "Music", count: "2" },
    ],
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-credits-page", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-top-bar")).not.toBeNull();
    expect(root.querySelector("mc-credits-list")).not.toBeNull();
  });

  it("says back when the bar's Back is pressed", async () => {
    const el = await mount();
    const heard = vi.fn();
    el.addEventListener("mc-credits", (event) => heard(event.detail));
    el.shadowRoot!.querySelector("mc-top-bar")!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "back" });
  });
});
