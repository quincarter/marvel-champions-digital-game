import { describe, expect, it } from "vitest";
import { selectionAmongVisible } from "./scenario-selection.js";

describe("selectionAmongVisible", () => {
  it("keeps a selection the shelf still shows", () => {
    expect(selectionAmongVisible("b", ["a", "b"])).toEqual({ selectedId: "b", canContinue: true });
  });
  it("moves a hidden selection (a chip or a search hid Rhino) to the first visible scenario", () => {
    expect(selectionAmongVisible("rhino", ["iron-man", "captain-marvel"])).toEqual({
      selectedId: "iron-man",
      canContinue: true,
    });
  });
  it("disables Choose heroes when nothing is visible, keeping the old id", () => {
    expect(selectionAmongVisible("rhino", [])).toEqual({ selectedId: "rhino", canContinue: false });
  });
});
