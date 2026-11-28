// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-controls-list.js";
import type { McControlsList } from "../McControlsList.js";

afterEach(() => document.body.replaceChildren());

async function mount(): Promise<McControlsList> {
  const el = document.createElement("mc-controls-list");
  el.sections = [{ id: "buttons", title: "Buttons", rows: [{ id: "a", glyphs: [{ kind: "key", label: "A" }], action: "Select", note: "Everywhere" }, { id: "b", glyphs: [], action: "Back", note: "Menus" }] }];
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-controls-list", () => {
  it("renders what it is given", async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-section-heading")).not.toBeNull();
    expect(root.querySelectorAll(".row").length).toBe(2);
    expect(root.querySelectorAll("mc-glyph").length).toBe(1);
    expect(root.querySelector(".action")!.textContent).toBe("Select");
  });
});
