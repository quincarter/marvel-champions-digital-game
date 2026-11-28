// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-deck-type-filter.js";

describe("mc-deck-type-filter", () => {
  it("draws a stop per chip, the chosen one selected, and says which filter was pressed", async () => {
    const el = document.createElement("mc-deck-type-filter");
    el.chips = [
      { id: "all", label: "All" },
      { id: "ally", label: "Allies" },
    ];
    el.selected = "ally";
    document.body.append(el);
    await el.updateComplete;
    const chips = [...el.shadowRoot!.querySelectorAll<HTMLElement & { selected: boolean }>("mc-button")];
    expect(chips.map((chip) => chip.dataset.stop)).toEqual(["filter:all", "filter:ally"]);
    expect(chips.map((chip) => chip.selected)).toEqual([false, true]);
    const heard = vi.fn();
    el.addEventListener("mc-deck-check", (event) => heard(event.detail));
    chips[0]!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "filter", filter: "all" });
    el.remove();
  });
});
