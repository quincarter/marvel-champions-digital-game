import { describe, expect, it } from "vitest";
import { modelIsStale } from "./model-staleness.js";

describe("modelIsStale", () => {
  it("is stale when the Play area order changed since the last draw", () => {
    expect(modelIsStale({ playAreaOrder: "played" }, { playAreaOrder: "type" })).toBe(true);
    expect(modelIsStale({ playAreaOrder: "cost" }, { playAreaOrder: "name" })).toBe(true);
  });
  it("is fresh when the order is unchanged or nothing was drawn yet", () => {
    expect(modelIsStale({ playAreaOrder: "type" }, { playAreaOrder: "type" })).toBe(false);
    expect(modelIsStale(null, { playAreaOrder: "type" })).toBe(false);
  });
});
