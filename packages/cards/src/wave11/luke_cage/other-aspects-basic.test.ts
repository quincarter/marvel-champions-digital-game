import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  LUKE_CAGE_OTHER_ASPECTS_BASIC as REGISTRY,
  LUKE_CAGE_OTHER_ASPECTS_BASIC_SKIPPED as SKIPPED,
} from "./other-aspects-basic.js";

/**
 * Wave 11 `luke_cage/other-aspects-basic` (docs/phase7-wave11-hero-packs.md H8.4). Scaffold test: the module's script
 * is checked in isolation.
 * The scripting task adds the card scenarios here and names each registered ability id in this file (the wave's
 * coverage guard fails an id no test in the pack folder names).
 */
describe("wave 11 luke_cage/other-aspects-basic", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("skips only refs it does not register, each with a written reason", () => {
    for (const [id, reason] of Object.entries(SKIPPED)) {
      expect(id in REGISTRY, id).toBe(false);
      expect(reason.length, id).toBeGreaterThan(20);
    }
  });
});

describe("62024.unbreakable-bond-action", () => {
  it("is the reprint of 61027's script, the same definition", async () => {
    const { JJ_BASIC } = await import("../jj/basic.js");
    expect(REGISTRY["62024.unbreakable-bond-action"]).toBe(JJ_BASIC["61027.unbreakable-bond-action"]);
    expect(REGISTRY["62024.unbreakable-bond-action"]!.trigger).toMatchObject({ kind: "action", form: "hero" });
  });
});
