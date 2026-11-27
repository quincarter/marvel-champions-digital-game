import { describe, expect, it } from "vitest";
import "./mc-stat-tiles.js";

describe("mc-stat-tiles", () => {
  it("draws the rows the caller wrapped, a boxed tile each", async () => {
    const el = document.createElement("mc-stat-tiles");
    el.rows = [
      [
        { id: "ally", text: "Allies 5" },
        { id: "event", text: "Events 14" },
      ],
      [{ id: "support", text: "Supports 7" }],
    ];
    document.body.append(el);
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll(".row")];
    expect(rows.map((row) => row.querySelectorAll(".tile").length)).toEqual([2, 1]);
    expect(el.shadowRoot!.querySelector('[data-key="event"]')?.textContent).toBe("Events 14");
    el.remove();
  });
});
