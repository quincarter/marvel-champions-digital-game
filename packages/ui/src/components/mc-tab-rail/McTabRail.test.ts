import { describe, expect, it } from "vitest";
import "./mc-tab-rail.js";

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-tab-rail", () => {
  it("draws a rail cell per tab, marks the chosen one, and badges a tab with news only when it is not chosen", async () => {
    const rail = document.createElement("mc-tab-rail");
    rail.tabs = [
      { id: "seats", label: "Seats", selected: true, badge: 4 },
      { id: "chat", label: "Chat", badge: 12 },
    ];
    document.body.append(rail);
    await rail.updateComplete;
    expect(rail.getAttribute("role")).toBe("tablist");
    const cells = rail.shadowRoot!.querySelectorAll("mc-button");
    expect(cells[0]!.getAttribute("aria-selected")).toBe("true");
    expect(cells[1]!.getAttribute("role")).toBe("tab");
    expect([...cells].map((c) => c.getAttribute("data-key"))).toEqual(["tab:seats", "tab:chat"]);
    expect(cells[0]!.hasAttribute("selected")).toBe(true);
    const badges = [...rail.shadowRoot!.querySelectorAll(".badge")].map((b) => b.textContent);
    expect(badges).toEqual(["9"]);
    rail.remove();
  });

  it("reports a tap on a cell with the prefixed key and the tab's id", async () => {
    const rail = document.createElement("mc-tab-rail");
    rail.prefix = "panel:";
    rail.tabs = [
      { id: "a", label: "A" },
      { id: "b", label: "B", disabled: "Not now" },
    ];
    document.body.append(rail);
    await rail.updateComplete;
    const seen: unknown[] = [];
    rail.addEventListener("mc-activate", (event) => seen.push((event as CustomEvent).detail));
    const cells = rail.shadowRoot!.querySelectorAll("mc-button");
    tap(cells[1]!);
    tap(cells[0]!);
    expect(seen).toEqual([{ key: "panel:a", id: "a" }]);
    rail.remove();
  });
});
