// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-pack-sort.js";
import type { McPackSort } from "../McPackSort.js";
import type { PackSortModel } from "../mc-pack-sort.types.js";

afterEach(() => document.body.replaceChildren());

const model: PackSortModel = {
  label: "Pack",
  pack: { label: "All packs ▾", on: false },
  cycle: { label: "All waves ▾", on: false },
  sort: { label: "Sort: Match", on: false },
  then: { label: "Then: None", on: false },
};

describe("mc-pack-sort", () => {
  it("names the stepper's parts and the three buttons by the stop keys the specs use", async () => {
    const el = await mount<McPackSort>("mc-pack-sort", { model });
    expect(stopKeys(el)).toEqual(["pack:prev", "pack:name", "pack:next", "pack:cycle", "pack:sort", "pack:then"]);
  });

  it("steps a pack at a time with the arrows and opens the picker from the name", async () => {
    const el = await mount<McPackSort>("mc-pack-sort", { model });
    const seen = builderEvents(el);
    press(stop(el, "pack:prev"));
    press(stop(el, "pack:next"));
    press(stop(el, "pack:name"));
    press(stop(el, "pack:cycle"));
    press(stop(el, "pack:sort"));
    press(stop(el, "pack:then"));
    expect(seen).toEqual([
      { type: "pack-step", dir: -1 },
      { type: "pack-step", dir: 1 },
      { type: "pack-pick" },
      { type: "cycle-pick" },
      { type: "sort" },
      { type: "then" },
    ]);
  });

  it("fills a button that has a filter or sort on", async () => {
    const el = await mount<McPackSort>("mc-pack-sort", {
      model: { ...model, sort: { label: "Sort: Cost", on: true } },
    });
    expect(stop(el, "pack:sort").hasAttribute("selected")).toBe(true);
    expect(stop(el, "pack:then").hasAttribute("selected")).toBe(false);
  });
});
