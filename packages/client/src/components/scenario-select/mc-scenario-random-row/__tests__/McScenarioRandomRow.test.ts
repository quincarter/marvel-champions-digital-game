// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, press, selectEvents } from "../../test-support.js";
import "../mc-scenario-random-row.js";

afterEach(() => document.body.replaceChildren());

describe("mc-scenario-random-row", () => {
  it("draws the two Random buttons on the full list, each a focus stop that presses its own key", async () => {
    const el = await mount("mc-scenario-random-row", {
      model: {
        drillBack: null,
        title: "",
        buttons: [
          { id: "random-box", label: "Random box" },
          { id: "random-scenario", label: "Random scenario" },
        ],
      },
    });
    const seen = selectEvents(el);
    const stops = [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")];
    expect(stops.map((stop) => stop.dataset.stop)).toEqual(["random-box", "random-scenario"]);
    press(stops[1]!);
    expect(seen).toEqual([{ type: "press", key: "random-scenario" }]);
  });

  it("drilled into a box, All packs leads the row and the box's name follows", async () => {
    const el = await mount("mc-scenario-random-row", {
      model: {
        drillBack: "All packs",
        title: "Core Set",
        buttons: [{ id: "random-villain", label: "Random villain" }],
      },
    });
    const stops = [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-stop]")].map((stop) => stop.dataset.stop);
    expect(stops).toEqual(["drill-back", "random-villain"]);
    expect(inner(el, ".title")!.textContent).toBe("Core Set");
  });
});
