// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-round-strip";

afterEach(() => document.body.replaceChildren());

async function strip(steps: string[]) {
  const el = document.createElement("mc-round-strip");
  el.label = "CADA RONDA";
  el.steps = steps;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-round-strip", () => {
  it("draws the label and a pill per beat, ink first and red next, with an arrow between", async () => {
    const el = await strip(["ACTÚAS Y ROBAS HASTA TU TAMAÑO DE MANO", "ACTÚA EL VILLANO"]);
    const root = el.shadowRoot!;
    expect(root.querySelector(".label")!.textContent).toBe("CADA RONDA");
    const pills = [...root.querySelectorAll(".pill")];
    expect(pills.map((p) => p.textContent)).toEqual(["ACTÚAS Y ROBAS HASTA TU TAMAÑO DE MANO", "ACTÚA EL VILLANO"]);
    expect(pills.map((p) => p.getAttribute("data-step"))).toEqual(["ink", "red"]);
    expect(root.querySelectorAll(".arrow")).toHaveLength(1);
  });

  it("draws no arrow for a single beat", async () => {
    const el = await strip(["ONE"]);
    expect(el.shadowRoot!.querySelectorAll(".arrow")).toHaveLength(0);
  });
});
