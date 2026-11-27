import { describe, expect, it } from "vitest";
import "./mc-bar-chart.js";

describe("mc-bar-chart", () => {
  it("draws a bar a column as tall as its count against the largest, never under 2px, red when highlighted", async () => {
    const el = document.createElement("mc-bar-chart");
    el.height = 118;
    el.bars = [
      { label: "0", count: 0, highlight: false },
      { label: "1", count: 10, highlight: true },
      { label: "2", count: 5, highlight: false },
    ];
    document.body.append(el);
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".bar")];
    expect(bars.map((bar) => bar.style.height)).toEqual(["2px", "100px", "50px"]);
    expect(bars.map((bar) => bar.classList.contains("highlight"))).toEqual([false, true, false]);
    expect([...el.shadowRoot!.querySelectorAll(".axis")].map((axis) => axis.textContent)).toEqual(["0", "1", "2"]);
    expect(el.style.height).toBe("118px");
    el.remove();
  });
});
