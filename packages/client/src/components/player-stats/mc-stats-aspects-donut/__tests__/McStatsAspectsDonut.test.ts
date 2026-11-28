// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-aspects-donut";

afterEach(() => document.body.replaceChildren());

describe("mc-stats-aspects-donut", () => {
  it("draws the ring from each aspect's games and names every aspect in its legend", async () => {
    const el = document.createElement("mc-stats-aspects-donut");
    el.chartKey = "donut:aspects";
    el.caption = "ASPECTS";
    el.shares = [
      { aspect: "justice", label: "Justice", games: 3, fill: "#f4c20d", text: "60% · 3 games · 67% won" },
      { aspect: "pool", label: "'Pool", games: 2, fill: "#f48fb1", text: "40% · 2 games · 50% won" },
    ];
    document.body.append(el);
    await el.updateComplete;
    const root = el.shadowRoot!;
    const donut = root.querySelector("mc-donut-chart")!;
    expect(donut.getAttribute("chart-key")).toBe("donut:aspects");
    expect(donut.slices.map((s) => s.value)).toEqual([3, 2]);
    expect([...root.querySelectorAll(".name")].map((n) => n.textContent)).toEqual(["Justice", "'Pool"]);
    expect(root.querySelectorAll(".text")[1]!.textContent).toBe("40% · 2 games · 50% won");
  });
});
