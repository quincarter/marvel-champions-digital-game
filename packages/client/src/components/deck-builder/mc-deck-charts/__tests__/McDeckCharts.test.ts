// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-deck-charts.js";
import type { McDeckCharts } from "../McDeckCharts.js";
import type { DeckChartsModel } from "../mc-deck-charts.types.js";

afterEach(() => document.body.replaceChildren());

const model: DeckChartsModel = {
  curveLabel: "Cost curve",
  curveTab: "Curve",
  oddsLabel: "Odds",
  oddsTab: "Odds",
  bars: [
    { label: "0", count: 3, highlight: false },
    { label: "4+", count: 1, highlight: true },
  ],
  odds: {
    empty: null,
    group: "Resource cards · 8",
    draws: "Draw 6",
    canFewer: true,
    canMore: true,
    line: "0: 10%",
    atLeast: "At least one: 90%",
  },
};

describe("mc-deck-charts", () => {
  it("shows one chart at a time behind two tabs", async () => {
    const el = await mount<McDeckCharts>("mc-deck-charts", { model, mode: "tabs", tab: "curve" });
    expect(stopKeys(el)).toEqual(["chart:curve", "chart:odds"]);
    expect(inner(el, "mc-bar-chart")).not.toBeNull();
    expect(inner(el, "mc-odds-panel")).toBeNull();
  });

  it("swaps the chart for the tab the scene says and reports a tab press", async () => {
    const el = await mount<McDeckCharts>("mc-deck-charts", { model, mode: "tabs", tab: "curve" });
    const seen = builderEvents(el);
    press(stop(el, "chart:odds"));
    expect(seen).toEqual([{ type: "chart-tab", tab: "odds" }]);
    el.tab = "odds";
    await el.updateComplete;
    expect(inner(el, "mc-odds-panel")).not.toBeNull();
  });

  it("stacks both charts under their own labels with no tabs", async () => {
    const el = await mount<McDeckCharts>("mc-deck-charts", { model, mode: "stacked" });
    expect(inner(el, "mc-bar-chart")).not.toBeNull();
    expect(inner(el, "mc-odds-panel")).not.toBeNull();
    expect(stopKeys(el).some((k) => k.startsWith("chart:"))).toBe(false);
  });
});
