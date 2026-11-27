import { describe, expect, it } from "vitest";
import "./mc-filter-bar.js";
import "../mc-media-row/mc-media-row.js";

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-filter-bar", () => {
  it("words a chosen chip with a check and an unchosen one with its count, and reports a tap with the prefixed key", async () => {
    const bar = document.createElement("mc-filter-bar");
    bar.chips = [
      { id: "tag:hero", label: "hero", count: 3, selected: false, width: 80 },
      { id: "tag:villain", label: "villain", selected: true, width: 90 },
      { id: "creator", label: "by Ann  ✕", selected: true, width: 120, mark: false },
    ];
    document.body.append(bar);
    await bar.updateComplete;
    const chips = [...bar.shadowRoot!.querySelectorAll("mc-filter-chip")];
    expect(chips.map((c) => (c as unknown as { text: string }).text)).toEqual(["hero 3", "✓ villain", "by Ann  ✕"]);
    expect(bar.elementOf("chip:tag:hero")).not.toBeNull();
    const seen: unknown[] = [];
    bar.addEventListener("mc-activate", (e) => seen.push((e as CustomEvent).detail));
    const button = chips[0]!.shadowRoot!.querySelector("mc-button")!;
    tap(button);
    expect(seen).toEqual([{ key: "chip:tag:hero", id: "tag:hero" }]);
    bar.remove();
  });
});

describe("mc-media-row", () => {
  it("shows its words, a letter while it has no picture, and a solid badge for a call to action", async () => {
    const row = document.createElement("mc-media-row");
    Object.assign(row, {
      heading: "Hero Pack",
      meta: "Hero · by Ann",
      summary: "A pack.",
      foot: "1 MB",
      badge: "+ Install",
      solid: true,
      letter: "H",
    });
    document.body.append(row);
    await row.updateComplete;
    expect(row.shadowRoot!.querySelector(".heading")?.textContent).toBe("Hero Pack");
    expect(row.shadowRoot!.querySelector(".badge.solid")?.textContent).toBe("+ Install");
    const tile = row.shadowRoot!.querySelector("mc-picture-tile")!;
    await (tile as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(tile.shadowRoot!.querySelector(".missing.letter")?.textContent).toBe("H");
    row.remove();
  });
});
