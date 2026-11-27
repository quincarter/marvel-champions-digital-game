import { afterEach, describe, expect, it } from "vitest";
import "./mc-bar-chart.js";
import type { BarChartBar } from "./mc-bar-chart.types.js";

afterEach(() => document.body.replaceChildren());

async function mount(bars: readonly BarChartBar[]) {
  const el = document.createElement("mc-bar-chart");
  el.bars = bars;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-bar-chart", () => {
  it("draws a bar a count, the highlighted one red", async () => {
    const el = await mount([
      { label: "0", count: 1, highlight: false },
      { label: "1", count: 4, highlight: true },
    ]);
    const bars = el.shadowRoot!.querySelectorAll(".bar");
    expect(bars).toHaveLength(2);
    expect(bars[1]!.classList.contains("highlight")).toBe(true);
    expect((bars[0] as HTMLElement).style.background).toBe("");
  });

  it("paints a bar with a tint of its own, and leaves the rest as they were", async () => {
    const el = await mount([
      { label: "0", count: 2, highlight: false, tint: "rgb(10, 20, 30)" },
      { label: "1", count: 2, highlight: false },
    ]);
    const bars = el.shadowRoot!.querySelectorAll<HTMLElement>(".bar");
    expect(bars[0]!.style.background).toBe("rgb(10, 20, 30)");
    expect(bars[1]!.style.background).toBe("");
  });
});
