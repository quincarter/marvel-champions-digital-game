import { describe, expect, it } from "vitest";
import "./mc-line-list.js";

describe("mc-line-list", () => {
  it("titles each group, draws a line a card with its count, and names the cards for a hover popover", async () => {
    const el = document.createElement("mc-line-list");
    el.groups = [
      {
        label: "Hero · 3",
        entries: [
          { name: "Backflip", quantity: 2, hover: "01010" },
          { name: "Aunt May", quantity: 1, hover: "01011" },
        ],
      },
      { label: "Basic · 1", entries: [{ name: "Energy", quantity: 1 }] },
    ];
    document.body.append(el);
    await el.updateComplete;
    expect([...el.shadowRoot!.querySelectorAll(".title")].map((t) => t.textContent)).toEqual(["Hero · 3", "Basic · 1"]);
    expect(el.shadowRoot!.querySelectorAll(".entry")).toHaveLength(3);
    expect(el.hoverEntries().map((entry) => entry.cardId)).toEqual(["01010", "01011"]);
    el.remove();
  });
});
