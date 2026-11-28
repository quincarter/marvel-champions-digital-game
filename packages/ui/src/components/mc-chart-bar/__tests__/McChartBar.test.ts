import { describe, expect, it } from "vitest";
import "../mc-chart-bar.js";

describe("mc-chart-bar", () => {
  it("sets the bar's share of the largest count and shows its label", async () => {
    const el = document.createElement("mc-chart-bar");
    el.label = "3";
    el.count = 5;
    el.max = 10;
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement>(".bar")!.style.getPropertyValue("--ratio")).toBe("0.5");
    expect(el.shadowRoot!.querySelector(".axis")!.textContent).toBe("3");
    el.remove();
  });

  it("takes a tint of its own and reflects highlight", async () => {
    const el = document.createElement("mc-chart-bar");
    el.tint = "rgb(1, 2, 3)";
    el.highlight = true;
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement>(".bar")!.style.getPropertyValue("--tint")).toBe("rgb(1, 2, 3)");
    expect(el.hasAttribute("highlight")).toBe(true);
    el.remove();
  });
});
