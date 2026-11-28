// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-deck-summary.js";

describe("mc-deck-summary", () => {
  it("draws a tile per count and a row per line", async () => {
    const el = document.createElement("mc-deck-summary");
    el.tiles = [
      { id: "resource", text: "Resources 12" },
      { id: "ally", text: "Allies 6" },
    ];
    el.rows = [
      { id: "a", cost: 1, costColor: "", name: "A", quantity: 2 },
      { id: "b", cost: null, costColor: "", name: "B", quantity: 1 },
      { id: "c", cost: 3, costColor: "", name: "C", quantity: 3 },
    ];
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("mc-stat-tile")).toHaveLength(2);
    expect(el.shadowRoot!.querySelectorAll("mc-deck-card-row")).toHaveLength(3);
    el.remove();
  });
});
