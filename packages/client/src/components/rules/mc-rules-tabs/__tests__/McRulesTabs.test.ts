// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-rules-tabs.js";

afterEach(() => document.body.replaceChildren());

describe("mc-rules-tabs", () => {
  it("says which tab was pressed", async () => {
    const el = document.createElement("mc-rules-tabs");
    el.tabs = [
      { id: "glossary", label: "Glossary" },
      { id: "cardList", label: "Card list" },
    ];
    el.selected = "glossary";
    document.body.append(el);
    await el.updateComplete;
    const rail = el.shadowRoot!.querySelector("mc-tab-rail")!;
    await rail.updateComplete;
    const heard = vi.fn();
    el.addEventListener("mc-rules", (event) => heard(event.detail));
    const cells = rail.shadowRoot!.querySelectorAll<HTMLElement>("mc-button");
    expect(cells[0]!.dataset.stop).toBe("tab:glossary");
    cells[1]!.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
    expect(heard).toHaveBeenCalledWith({ type: "tab", tab: "cardList" });
  });
});
