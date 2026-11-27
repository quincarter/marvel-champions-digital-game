import { afterEach, describe, expect, it } from "vitest";
import "./mc-filter-bar.js";
import type { McFilterBar } from "./McFilterBar.js";

afterEach(() => document.body.replaceChildren());

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

async function mount(props: Partial<McFilterBar>): Promise<McFilterBar> {
  const bar = document.createElement("mc-filter-bar");
  Object.assign(bar, props);
  document.body.append(bar);
  await bar.updateComplete;
  return bar;
}

const text = (chip: Element) => (chip as unknown as { text: string }).text;

describe("mc-filter-bar", () => {
  it("words a chosen chip with a check and an unchosen one with its count, and reports a tap with the prefixed key", async () => {
    const bar = await mount({
      chips: [
        { id: "tag:hero", label: "hero", count: 3, selected: false, width: 80 },
        { id: "tag:villain", label: "villain", selected: true, width: 90 },
        { id: "creator", label: "by Ann  ✕", selected: true, width: 120, mark: false },
      ],
    });
    const chips = [...bar.shadowRoot!.querySelectorAll("mc-filter-chip")];
    expect(chips.map(text)).toEqual(["hero 3", "✓ villain", "by Ann  ✕"]);
    expect(chips[0]!.getAttribute("style")).toContain("width:80px");
    expect(bar.elementOf("chip:tag:hero")).not.toBeNull();
    const seen: unknown[] = [];
    bar.addEventListener("mc-activate", (e) => seen.push((e as CustomEvent).detail));
    await chips[0]!.updateComplete;
    tap(chips[0]!.shadowRoot!.querySelector("mc-button")!);
    expect(seen).toEqual([{ key: "chip:tag:hero", id: "tag:hero" }]);
  });

  it("wraps without a limit by default and packs into rows of a set height when asked", async () => {
    const bar = await mount({ chips: [{ id: "a", label: "A", selected: false }] });
    expect(bar.shadowRoot!.querySelector(".bar")!.getAttribute("style")).not.toContain("max-height");
    expect(bar.shadowRoot!.querySelector("mc-filter-chip")!.getAttribute("style")).toContain("min-height:44px");
    bar.rows = 2;
    bar.rowHeight = 40;
    await bar.updateComplete;
    expect(bar.shadowRoot!.querySelector(".bar")!.getAttribute("style")).toContain("max-height:88px");
    expect(bar.shadowRoot!.querySelector("mc-filter-chip")!.getAttribute("style")).toContain("height:40px");
  });

  it("shows the count on a chosen chip only with count-always, and does not press a disabled chip", async () => {
    const bar = await mount({
      chips: [
        { id: "x", label: "X", count: 2, selected: true },
        { id: "y", label: "Y", selected: false, disabled: "Nothing matches" },
      ],
    });
    const chips = [...bar.shadowRoot!.querySelectorAll("mc-filter-chip")];
    expect(text(chips[0]!)).toBe("✓ X");
    (chips[0] as unknown as { countAlways: boolean }).countAlways = true;
    expect(text(chips[0]!)).toBe("✓ X 2");
    const seen: unknown[] = [];
    bar.addEventListener("mc-activate", (e) => seen.push((e as CustomEvent).detail));
    await chips[1]!.updateComplete;
    const button = chips[1]!.shadowRoot!.querySelector("mc-button")!;
    expect(button.hasAttribute("disabled")).toBe(true);
    tap(button);
    expect(seen).toEqual([]);
  });

  it("reports a sort and the filter sheet button", async () => {
    const bar = await mount({
      chips: [{ id: "all", label: "All", count: 5, selected: false }],
      sort: {
        label: "Sort",
        value: "new",
        options: [
          { value: "new", label: "Newest" },
          { value: "old", label: "Oldest" },
        ],
      },
      sheetLabel: "Filters · 1",
    });
    const events: string[] = [];
    bar.addEventListener("mc-sort", (e) => events.push(`sort:${(e as CustomEvent<{ value: string }>).detail.value}`));
    bar.addEventListener("mc-filter-sheet", () => events.push("sheet"));
    const sheet = bar.shadowRoot!.querySelector("mc-button.sheet")!;
    expect((sheet as unknown as { label: string }).label).toBe("Filters · 1");
    tap(sheet);
    const select = bar.shadowRoot!.querySelector("select")!;
    select.value = "old";
    select.dispatchEvent(new Event("change"));
    expect(events).toEqual(["sheet", "sort:old"]);
  });

  it("lays a rail as one row that scrolls sideways, and wraps otherwise", async () => {
    const wrapped = await mount({ chips: [{ id: "a", label: "A", selected: false }] });
    expect(wrapped.shadowRoot!.querySelector(".bar.rail")).toBeNull();
    const rail = await mount({ chips: [{ id: "a", label: "A", selected: false }], rail: true });
    expect(rail.shadowRoot!.querySelector(".bar.rail")).not.toBeNull();
  });

  it("leaves out the sort and the sheet button when there are none", async () => {
    const bar = await mount({ chips: [] });
    expect(bar.shadowRoot!.querySelector("select")).toBeNull();
    expect(bar.shadowRoot!.querySelector(".sheet")).toBeNull();
  });
});

describe("mc-filter-bar tint, info segment and rail scroll", () => {
  it("tints a chip, draws an info segment that raises mc-info and not mc-activate, and scrolls in one row", async () => {
    const bar = document.createElement("mc-filter-bar");
    bar.rail = true;
    bar.prefix = "hero-chip:";
    bar.chips = [
      {
        id: "aspect:justice",
        label: "Justice",
        selected: false,
        tint: { fill: "#f0c040", ink: "#111111" },
        info: { open: false, label: "About Justice" },
      },
      { id: "playable-now", label: "Playable now", selected: true },
    ];
    document.body.append(bar);
    await bar.updateComplete;
    expect(bar.hasAttribute("rail")).toBe(true);
    const chip = bar.elementOf("hero-chip:aspect:justice") as HTMLElement & { tint: unknown };
    expect(chip.tint).toEqual({ fill: "#f0c040", ink: "#111111" });
    const info = bar.elementOf("hero-chip:aspect:justice:info")!;
    expect(info).toBeTruthy();
    expect(info.getAttribute("aria-label")).toBe("About Justice");
    expect(bar.elementOf("hero-chip:playable-now:info")).toBeNull();
    const heard: string[] = [];
    bar.addEventListener("mc-info", (event) => heard.push(`info ${(event as CustomEvent<{ id: string }>).detail.id}`));
    bar.addEventListener("mc-activate", () => heard.push("activate"));
    info.dispatchEvent(new CustomEvent("mc-press", { bubbles: true }));
    expect(heard).toEqual(["info aspect:justice"]);
    expect(bar.scroller).toBeTruthy();
    bar.remove();
  });
});
