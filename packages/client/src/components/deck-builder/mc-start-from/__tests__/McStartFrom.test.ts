// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { builderEvents, mount, press, stop, stopKeys } from "../../shared/test-support.js";
import "../mc-start-from.js";
import type { McStartFrom } from "../McStartFrom.js";
import type { StartFromModel } from "../mc-start-from.types.js";

afterEach(() => document.body.replaceChildren());

const model: StartFromModel = {
  label: "Start Spider-Man from",
  cardId: "01001a",
  picture: { src: null },
  options: [
    { id: null, label: "Empty deck" },
    { id: "starter-1", label: "Justice precon", tint: { fill: "#ffd200", ink: "#111" } },
  ],
  backLabel: "Back to heroes",
};

describe("mc-start-from", () => {
  it("names the empty start, each precon and Back as the stops the specs use", async () => {
    const el = await mount<McStartFrom>("mc-start-from", { model });
    expect(stopKeys(el)).toEqual(["start:empty", "start:starter-1", "start:back"]);
  });

  it("says which start was pressed, and Back", async () => {
    const el = await mount<McStartFrom>("mc-start-from", { model });
    const seen = builderEvents(el);
    press(stop(el, "start:empty"));
    press(stop(el, "start:starter-1"));
    press(stop(el, "start:back"));
    expect(seen).toEqual([{ type: "start", id: null }, { type: "start", id: "starter-1" }, { type: "start-back" }]);
  });

  it("draws a precon in its aspect's colors", async () => {
    const el = await mount<McStartFrom>("mc-start-from", { model });
    expect(stop(el, "start:starter-1").getAttribute("style")).toContain("--mc-tint-fill:#ffd200");
  });
});
