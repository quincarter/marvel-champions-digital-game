// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, inner, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-odds-panel.js";
import type { McOddsPanel } from "../McOddsPanel.js";
import type { OddsModel } from "../mc-odds-panel.types.js";

afterEach(() => document.body.replaceChildren());

const model: OddsModel = {
  empty: null,
  group: "Gives physical · 8",
  draws: "Draw 6 (opening hand)",
  canFewer: true,
  canMore: false,
  line: "0: 12%   1: 40%",
  atLeast: "At least one: 88%",
};

describe("mc-odds-panel", () => {
  it("names the six stepper parts by the stop keys the specs use", async () => {
    const el = await mount<McOddsPanel>("mc-odds-panel", { model });
    expect(stopKeys(el)).toEqual(["odds:prev", "odds:group", "odds:next", "odds:fewer", "odds:draws", "odds:more"]);
  });

  it("steps the group, the draw count, and returns to the opening hand from the middle", async () => {
    const el = await mount<McOddsPanel>("mc-odds-panel", { model: { ...model, canMore: true } });
    const seen = builderEvents(el);
    for (const key of ["odds:prev", "odds:group", "odds:next", "odds:fewer", "odds:more", "odds:draws"])
      press(stop(el, key));
    expect(seen.map((s) => (s as { part: string }).part)).toEqual([
      "group-prev",
      "group-next",
      "group-next",
      "fewer",
      "more",
      "opening",
    ]);
  });

  it("dims a draw count that cannot go further", async () => {
    const el = await mount<McOddsPanel>("mc-odds-panel", { model });
    expect(stop(el, "odds:more").hasAttribute("disabled")).toBe(true);
    expect(stop(el, "odds:fewer").hasAttribute("disabled")).toBe(false);
  });

  it("says there is nothing to measure for an empty deck", async () => {
    const el = await mount<McOddsPanel>("mc-odds-panel", { model: { ...model, empty: "Add cards first." } });
    expect(inner(el, ".empty")!.textContent).toBe("Add cards first.");
    expect(stopKeys(el)).toEqual([]);
  });
});
