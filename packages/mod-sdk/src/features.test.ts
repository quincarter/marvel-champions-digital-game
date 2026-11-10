import { heroAction, thwartAScheme } from "@mc/cards";
import { dslFeatures, SUPPORTED_DSL_FEATURES } from "./features.js";
import { definePackAbilities } from "./define.js";
import tiny from "./fixtures/tiny-pack/abilities/index.js";

describe("dslFeatures", () => {
  it("lists the features of a known registry, sorted", () => {
    const features = dslFeatures(tiny);
    expect(features).toEqual([...features].sort());
    expect(features).toContain("trigger:action");
    expect(features).toContain("effect:thwart");
    expect(features.every((f) => /^[a-z-]+:[A-Za-z0-9]+$/.test(f))).toBe(true);
  });

  it("is deterministic and independent of key order", () => {
    const a = definePackAbilities({
      "x.p.01.a": heroAction({ label: "thwart" }, thwartAScheme(2)),
      "x.p.01.b": heroAction({ label: "thwart" }, thwartAScheme(3)),
    });
    const b = definePackAbilities({ "x.p.01.b": a["x.p.01.b"], "x.p.01.a": a["x.p.01.a"] });
    expect(dslFeatures(a)).toEqual(dslFeatures(b));
  });

  it("an empty registry uses nothing", () => {
    expect(dslFeatures({})).toEqual([]);
  });

  it("the supported list covers the fixture and is non-trivial", () => {
    const supported = new Set(SUPPORTED_DSL_FEATURES);
    expect(dslFeatures(tiny).every((f) => supported.has(f))).toBe(true);
    expect(SUPPORTED_DSL_FEATURES.length).toBeGreaterThan(100);
    expect(SUPPORTED_DSL_FEATURES).toContain("effect:dealDamage");
  });
});
