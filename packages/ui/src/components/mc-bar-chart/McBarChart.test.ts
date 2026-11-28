import { describe, expect, it } from "vitest";
import "./mc-bar-chart.js";

type Bar = HTMLElement & { label: string; count: number; max: number; highlight: boolean; tint: string };

describe("mc-bar-chart", () => {
  it("gives each column its count against the largest, its label and its highlight, and sets the chart height", async () => {
    const el = document.createElement("mc-bar-chart");
    el.height = 118;
    el.bars = [
      { label: "0", count: 0, highlight: false },
      { label: "1", count: 10, highlight: true },
      { label: "2", count: 5, highlight: false },
    ];
    document.body.append(el);
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll<Bar>("mc-chart-bar")];
    expect(bars.map((bar) => [bar.label, bar.count, bar.max, bar.highlight])).toEqual([
      ["0", 0, 10, false],
      ["1", 10, 10, true],
      ["2", 5, 10, false],
    ]);
    expect(el.style.getPropertyValue("--chart-height")).toBe("118px");
    el.remove();
  });

  it("passes a bar's tint on, and leaves the rest as they were", async () => {
    const el = document.createElement("mc-bar-chart");
    el.bars = [
      { label: "0", count: 2, highlight: false, tint: "rgb(10, 20, 30)" },
      { label: "1", count: 2, highlight: false },
    ];
    document.body.append(el);
    await el.updateComplete;
    const bars = el.shadowRoot!.querySelectorAll<Bar>("mc-chart-bar");
    expect(bars[0]!.tint).toBe("rgb(10, 20, 30)");
    expect(bars[1]!.tint).toBe("");
    el.remove();
  });
});
