import { describe, expect, it } from "vitest";
import "../mc-stat-tile.js";

describe("mc-stat-tile", () => {
  it("shows its text in the box", async () => {
    const el = document.createElement("mc-stat-tile");
    el.text = "Events 14";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toBe("Events 14");
    el.remove();
  });
});
