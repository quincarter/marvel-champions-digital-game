import { afterEach, describe, expect, it } from "vitest";
import "./mc-tab-rail.js";
import type { McTabRail } from "./McTabRail.js";

afterEach(() => document.body.replaceChildren());

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

async function mount(props: Partial<McTabRail>): Promise<McTabRail> {
  const rail = document.createElement("mc-tab-rail");
  Object.assign(rail, props);
  document.body.append(rail);
  await rail.updateComplete;
  return rail;
}

describe("mc-tab-rail", () => {
  it("draws a rail cell per tab, marks the chosen one, and badges a tab with news only when it is not chosen", async () => {
    const rail = await mount({
      tabs: [
        { id: "seats", label: "Seats", selected: true, badge: 4 },
        { id: "chat", label: "Chat", badge: 12 },
      ],
    });
    expect(rail.getAttribute("role")).toBe("tablist");
    const cells = rail.shadowRoot!.querySelectorAll("mc-button");
    expect(cells[0]!.getAttribute("aria-selected")).toBe("true");
    expect(cells[1]!.getAttribute("role")).toBe("tab");
    expect([...cells].map((c) => c.getAttribute("data-key"))).toEqual(["tab:seats", "tab:chat"]);
    expect(cells[0]!.hasAttribute("selected")).toBe(true);
    expect([...rail.shadowRoot!.querySelectorAll(".badge")].map((b) => b.textContent)).toEqual(["9+"]);
  });

  it("takes the chosen tab from the rail selected id as well", async () => {
    const rail = await mount({
      tabs: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma", disabled: true },
      ],
      selected: "b",
    });
    const cells = [...rail.shadowRoot!.querySelectorAll("mc-button")];
    expect(cells.map((cell) => cell.hasAttribute("selected"))).toEqual([false, true, false]);
    expect(cells.map((cell) => cell.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(cells[2]!.hasAttribute("disabled")).toBe(true);
  });

  it("reports a tap on a cell with the prefixed key and the tab id, and none on a disabled one", async () => {
    const rail = await mount({
      prefix: "panel:",
      tabs: [
        { id: "a", label: "A" },
        { id: "b", label: "B", disabled: "Not now" },
        { id: "c", label: "C", disabled: false },
      ],
    });
    const seen: unknown[] = [];
    rail.addEventListener("mc-activate", (event) => seen.push((event as CustomEvent).detail));
    const cells = rail.shadowRoot!.querySelectorAll("mc-button");
    expect(cells[2]!.hasAttribute("disabled")).toBe(false);
    tap(cells[1]!);
    tap(cells[0]!);
    expect(seen).toEqual([{ key: "panel:a", id: "a" }]);
    cells[1]!.dispatchEvent(new CustomEvent("mc-press"));
    expect(seen).toHaveLength(1);
  });

  it("sizes the labels when asked and leaves the button size alone otherwise", async () => {
    const rail = await mount({ tabs: [{ id: "a", label: "A" }], size: 11 });
    expect(rail.shadowRoot!.querySelector("mc-button")!.getAttribute("style")).toContain("--mc-button-size:11px");
    rail.size = 0;
    await rail.updateComplete;
    expect(rail.shadowRoot!.querySelector("mc-button")!.getAttribute("style") ?? "").not.toContain("--mc-button-size");
  });
});
