// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-deck-group-tiles.js";

describe("mc-deck-group-tiles", () => {
  it("says the deck is empty when it has no groups, and draws a tile per group otherwise", async () => {
    const el = document.createElement("mc-deck-group-tiles");
    el.heading = "COMPOSITION BY ASPECT";
    el.empty = "No cards yet.";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".empty")!.textContent).toBe("No cards yet.");
    el.tiles = [
      { id: "justice", text: "Justice 14" },
      { id: "basic", text: "Basic 12" },
    ];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".empty")).toBeNull();
    expect(el.shadowRoot!.querySelectorAll("mc-stat-tile")).toHaveLength(2);
    el.remove();
  });
});
