import { describe, expect, test } from "vitest";
import { removalCostIcons } from "./removal-cost-icons.js";

describe("removalCostIcons (#767)", () => {
  test("resources, then the hero", () => {
    expect(removalCostIcons({ exhaustIdentity: true, resources: { physical: 2 } })).toBe("ppg");
  });

  test("each type in physical, mental, energy order", () => {
    expect(removalCostIcons({ resources: { energy: 1, mental: 1, physical: 1 } })).toBe("pme");
  });

  test("no cost, or a part with no glyph, has no icon form", () => {
    expect(removalCostIcons(undefined)).toBeNull();
    expect(removalCostIcons({})).toBeNull();
    expect(removalCostIcons({ resources: { physical: 1 }, damageSelf: 1 })).toBeNull();
    expect(removalCostIcons({ eachPlayer: { exhaustIdentity: true, damageSelf: 1 } })).toBeNull();
    expect(removalCostIcons({ resources: 2 })).toBeNull();
  });
});
