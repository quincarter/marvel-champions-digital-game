import { describe, expect, it } from "vitest";
import { setup } from "./abilities.js";
import { setVillainSide } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { theVillain } from "./values.js";

/**
 * docs/phase7-wave11-scenarios.md §S3.4: "Setup: Put the villain into play on a random side" (Disturbed Psyche
 * 60112).
 */
describe("setVillainSide", () => {
  it("compiles to the engine's setVillainSide effect", () => {
    expect(setVillainSide(theVillain, "random")).toEqual({
      kind: "setVillainSide",
      villain: theVillain,
      side: "random",
    });
    expect(setVillainSide(theVillain, "B")).toEqual({ kind: "setVillainSide", villain: theVillain, side: "B" });
  });
  it("is a valid Setup ability", () => {
    const definition = setup(setVillainSide(theVillain, "random"));
    expect(definition.trigger).toEqual({ kind: "setup" });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
