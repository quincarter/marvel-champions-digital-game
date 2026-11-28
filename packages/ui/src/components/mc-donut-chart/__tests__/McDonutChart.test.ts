// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-donut-chart";

afterEach(() => document.body.replaceChildren());

async function donut(set: (el: HTMLElementTagNameMap["mc-donut-chart"]) => void) {
  const el = document.createElement("mc-donut-chart");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-donut-chart", () => {
  it("draws an arc for each share and names the drawing by its key", async () => {
    const el = await donut((d) => {
      d.chartKey = "donut:aspects";
      d.center = "Aspects";
      d.slices = [
        { value: 2, color: "red" },
        { value: 1, color: "blue" },
      ];
    });
    const root = el.shadowRoot!;
    expect(root.querySelector("svg")!.getAttribute("data-key")).toBe("donut:aspects");
    expect(root.querySelectorAll("path.ring")).toHaveLength(2);
    expect(root.querySelector(".center")!.textContent).toBe("Aspects");
  });

  it("draws a single whole share as a full ring", async () => {
    const whole = await donut((d) => {
      d.slices = [{ value: 5, color: "red" }];
    });
    expect(whole.shadowRoot!.querySelectorAll("circle.ring")).toHaveLength(1);
    expect(whole.shadowRoot!.querySelectorAll("path.ring")).toHaveLength(0);
  });

  it("sizes itself from the size property", async () => {
    const el = await donut((d) => {
      d.size = 124;
    });
    expect(el.style.getPropertyValue("--donut-size")).toBe("124px");
  });
});
