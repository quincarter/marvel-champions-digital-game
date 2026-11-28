// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-deck-list-panel.js";

describe("mc-deck-list-panel", () => {
  it("lists the groups, shows the cut-off note only when there is one, and says sort when the button is pressed", async () => {
    const el = document.createElement("mc-deck-list-panel");
    el.heading = "YOUR DECK";
    el.sortLabel = "Sort: Aspect";
    el.groups = [{ label: "Hero · 2", entries: [{ name: "Web-Shooter", quantity: 2, hover: "01001" }] }];
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more")).toBeNull();
    expect(el.shadowRoot!.querySelector<HTMLElement & { groups: unknown[] }>("mc-line-list")!.groups).toHaveLength(1);
    el.more = "+ 4 more";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more")!.textContent).toBe("+ 4 more");
    const heard = vi.fn();
    el.addEventListener("mc-deck-check", (event) => heard(event.detail));
    el.shadowRoot!.querySelector('[data-stop="deck-sort"]')!.dispatchEvent(
      new CustomEvent("mc-press", { bubbles: true, composed: true }),
    );
    expect(heard).toHaveBeenCalledWith({ type: "sort" });
    el.remove();
  });
});
