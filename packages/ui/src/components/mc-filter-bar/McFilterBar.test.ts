import { describe, expect, it } from "vitest";
import "./mc-filter-bar.js";
import "../mc-section-header/mc-section-header.js";
import "../mc-empty-state/mc-empty-state.js";
import "../mc-picture-tile/mc-picture-tile.js";

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-filter-bar", () => {
  it("composes chips with counts, reports a tapped chip, a sort and the sheet button", async () => {
    const bar = document.createElement("mc-filter-bar");
    bar.model = {
      chips: [
        { key: "all", label: "All", count: 5, selected: true },
        { key: "won", label: "Wins", count: 4, selected: false },
      ],
      sort: {
        label: "Sort",
        value: "new",
        options: [
          { value: "new", label: "Newest" },
          { value: "old", label: "Oldest" },
        ],
      },
      sheetLabel: "Filters · 1",
    };
    document.body.append(bar);
    await bar.updateComplete;
    const chips = [...bar.shadowRoot!.querySelectorAll("mc-filter-chip")];
    expect(chips).toHaveLength(2);
    await chips[0]!.updateComplete;
    expect(chips[0]!.shadowRoot!.textContent).toContain("(5)");
    expect(chips[0]!.shadowRoot!.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");
    const events: string[] = [];
    bar.addEventListener("mc-filter", (e) => events.push(`filter:${(e as CustomEvent<{ key: string }>).detail.key}`));
    bar.addEventListener("mc-sort", (e) => events.push(`sort:${(e as CustomEvent<{ value: string }>).detail.value}`));
    bar.addEventListener("mc-filter-sheet", () => events.push("sheet"));
    await chips[1]!.updateComplete;
    tap(chips[1]!.shadowRoot!.querySelector("button")!);
    tap(bar.shadowRoot!.querySelector(".sheet")!);
    const select = bar.shadowRoot!.querySelector("select")!;
    select.value = "old";
    select.dispatchEvent(new Event("change"));
    expect(events).toEqual(["filter:won", "sheet", "sort:old"]);
    bar.remove();
  });

  it("does not press a disabled chip", async () => {
    const bar = document.createElement("mc-filter-bar");
    bar.model = { chips: [{ key: "x", label: "X", selected: false, disabled: true }] };
    document.body.append(bar);
    await bar.updateComplete;
    const chip = bar.shadowRoot!.querySelector("mc-filter-chip")!;
    await chip.updateComplete;
    let fired = 0;
    bar.addEventListener("mc-filter", () => fired++);
    tap(chip.shadowRoot!.querySelector("button")!);
    expect(fired).toBe(0);
    bar.remove();
  });
});

describe("display components", () => {
  it("a section header shows its chevron, title and count", async () => {
    const el = document.createElement("mc-section-header");
    Object.assign(el, { heading: "Heroes", count: "3 of 7", open: "false" });
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("▸ Heroes");
    expect(el.shadowRoot!.textContent).toContain("3 of 7");
    el.remove();
  });

  it("an empty state says its message; a picture tile says what is missing when it has no picture", async () => {
    const empty = document.createElement("mc-empty-state");
    empty.message = "Nothing yet";
    const tile = document.createElement("mc-picture-tile");
    tile.missing = "no scan";
    document.body.append(empty, tile);
    await Promise.all([empty.updateComplete, tile.updateComplete]);
    expect(empty.shadowRoot!.textContent).toContain("Nothing yet");
    expect(tile.shadowRoot!.textContent).toContain("no scan");
    empty.remove();
    tile.remove();
  });
});
