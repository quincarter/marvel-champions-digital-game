import { afterEach, describe, expect, it } from "vitest";
import "./mc-filter-bar.js";
import type { McFilterBarModel } from "./mc-filter-bar.types.js";

afterEach(() => document.body.replaceChildren());

async function bar(model: McFilterBarModel) {
  const el = document.createElement("mc-filter-bar");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

const chips = [
  { id: "a", label: "Aggression", count: 4, selected: true },
  { id: "b", label: "Justice", selected: false },
  { id: "c", label: "Pool", selected: false, disabled: true },
];

describe("mc-filter-bar", () => {
  it("draws a chip per filter with its count and a check mark while on, and reports a tap by key", async () => {
    const el = await bar({ chips });
    const cells = [...el.shadowRoot!.querySelectorAll("[data-key]")];
    expect(cells.map((cell) => cell.getAttribute("data-key"))).toEqual(["chip:a", "chip:b", "chip:c"]);
    const first = cells[0]!.querySelector("mc-filter-chip")!;
    await (first as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(first.shadowRoot!.textContent).toContain("✓");
    expect(first.shadowRoot!.querySelector(".count")!.textContent).toBe("4");
    expect(first.hasAttribute("selected")).toBe(true);
    const seen: { key: string; id?: string }[] = [];
    el.addEventListener("mc-activate", (event) => seen.push((event as CustomEvent).detail));
    tap(cells[1]!.querySelector("mc-filter-chip")!.shadowRoot!.querySelector("button")!);
    tap(cells[2]!.querySelector("mc-filter-chip")!.shadowRoot!.querySelector("button")!);
    expect(seen).toEqual([{ key: "chip:b", id: "b" }]);
  });

  it("folds the chips behind a Filters button until it is open, and the sort chip steps its option", async () => {
    const el = await bar({
      chips,
      filters: { label: "Filters", open: false, active: 1 },
      sort: { label: "Sort: Cost", nextId: "name" },
    });
    expect([...el.shadowRoot!.querySelectorAll("[data-key]")].map((cell) => cell.getAttribute("data-key"))).toEqual([
      "filters",
      "sort",
    ]);
    const seen: { key: string; id?: string }[] = [];
    el.addEventListener("mc-activate", (event) => seen.push((event as CustomEvent).detail));
    const press = (key: string): void =>
      tap(el.shadowRoot!.querySelector(`[data-key="${key}"] mc-filter-chip`)!.shadowRoot!.querySelector("button")!);
    press("filters");
    press("sort");
    expect(seen).toEqual([{ key: "filters" }, { key: "sort", id: "name" }]);
    el.model = { chips, filters: { label: "Filters", open: true, active: 1 } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("[data-key^='chip:']")).toHaveLength(3);
  });
});
