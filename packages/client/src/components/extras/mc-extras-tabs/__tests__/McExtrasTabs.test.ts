// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-extras-tabs.js";

afterEach(() => document.body.replaceChildren());

describe("mc-extras-tabs", () => {
  it("draws the rail with the chosen tab marked, and says which tab was pressed", async () => {
    const el = document.createElement("mc-extras-tabs");
    el.tabs = [
      { id: "stories", label: "Stories 1/2" },
      { id: "music", label: "Music 0/3" },
    ];
    el.selected = "stories";
    document.body.append(el);
    await el.updateComplete;
    const rail = el.shadowRoot!.querySelector("mc-tab-rail")!;
    await rail.updateComplete;
    const cells = [...rail.shadowRoot!.querySelectorAll<HTMLElement>("mc-button")];
    expect(cells.map((cell) => cell.dataset.stop)).toEqual(["tab:stories", "tab:music"]);
    expect(cells[0]!.hasAttribute("selected")).toBe(true);
    const heard = vi.fn();
    el.addEventListener("mc-extras", (event) => heard(event.detail));
    cells[1]!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "tab", id: "music" });
  });

  it("shows the LB / RB hint only when it is given one", async () => {
    const el = document.createElement("mc-extras-tabs");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".hint")).toBeNull();
    el.hint = { specs: [], width: 30, height: 16, ground: "paper", openness: 1 };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".hint mc-glyph")).not.toBeNull();
  });
});
