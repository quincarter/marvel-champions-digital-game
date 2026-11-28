// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-cost-curve.js";

describe("mc-cost-curve", () => {
  it("titles the chart, shows the average only when given, and sizes the chart for its frame", async () => {
    const el = document.createElement("mc-cost-curve");
    el.heading = "Cost curve";
    el.bars = [{ label: "0", count: 3, highlight: true }];
    document.body.append(el);
    await el.updateComplete;
    const chart = el.shadowRoot!.querySelector<HTMLElement & { bars: unknown[]; height: number }>("mc-bar-chart")!;
    expect(el.shadowRoot!.querySelector(".heading")!.textContent).toBe("Cost curve");
    expect(el.shadowRoot!.querySelector(".average")).toBeNull();
    expect(chart.bars).toHaveLength(1);
    const railHeight = chart.height;
    el.average = "avg 2.4";
    el.framed = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".average")!.textContent).toBe("avg 2.4");
    expect(chart.height).toBeGreaterThan(railHeight);
    el.remove();
  });
});
