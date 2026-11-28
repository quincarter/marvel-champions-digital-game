import { afterEach, describe, expect, it } from "vitest";
import "../mc-search-toggle.js";

afterEach(() => document.body.replaceChildren());

describe("mc-search-toggle", () => {
  it("names itself and reports whether it is on, in attributes a screen reader reads", async () => {
    const el = document.createElement("mc-search-toggle");
    el.label = "Search";
    el.selected = true;
    document.body.append(el);
    await el.updateComplete;
    expect(el.getAttribute("aria-label")).toBe("Search");
    expect(el.getAttribute("aria-pressed")).toBe("true");
  });

  it("raises mc-press from a focus stop click (detail 0) and ignores a pointer click, which is the tap", async () => {
    const el = document.createElement("mc-search-toggle");
    document.body.append(el);
    await el.updateComplete;
    let presses = 0;
    el.addEventListener("mc-press", () => presses++);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    expect(presses).toBe(1);
  });
});
