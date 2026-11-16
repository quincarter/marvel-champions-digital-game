import { describe, expect, it } from "vitest";

import { randomBox, randomBoxOptions, randomScenario, randomVillainIn } from "./scenario-random.js";
import type { Shelf } from "./roster-shelves.js";

const shelves: readonly Shelf<string>[] = [
  { id: "core", title: "Core", items: ["rhino", "klaw"] },
  { id: "tile", title: "Only a tile", items: ["BUILD"] },
  { id: "mod", title: "Mod", items: ["ghost"] },
];
const isScenario = (item: string): boolean => item !== "BUILD";
const sweep = (fn: (r: () => number) => void): void => {
  for (let i = 0; i < 20; i++) fn(() => i / 20);
};

describe("scenario random", () => {
  it("offers only boxes holding a scenario", () => {
    expect(randomBoxOptions(shelves, isScenario).map((s) => s.id)).toEqual(["core", "mod"]);
  });

  it("step one picks only an offered box, and reaches each", () => {
    const seen = new Set<string>();
    sweep((r) => seen.add(randomBox(shelves, isScenario, r)!.id));
    expect([...seen].sort()).toEqual(["core", "mod"]);
  });

  it("step two picks only a scenario of that box", () => {
    const seen = new Set<string>();
    sweep((r) => seen.add(randomVillainIn(shelves[0]!, isScenario, r)!));
    expect([...seen].sort()).toEqual(["klaw", "rhino"]);
    expect(randomVillainIn(shelves[1]!, isScenario, () => 0)).toBeNull();
  });

  it("both steps land on a scenario inside its own box", () => {
    const seen = new Set<string>();
    // The two steps draw twice, so a steady sequence (not one fixed number) lets every pair come up.
    let n = 0;
    const steady = (): number => (n++ * 0.37) % 1;
    sweep(() => {
      const pick = randomScenario(shelves, isScenario, steady)!;
      expect(pick.shelf.items).toContain(pick.item);
      expect(isScenario(pick.item)).toBe(true);
      seen.add(pick.item);
    });
    expect([...seen].sort()).toEqual(["ghost", "klaw", "rhino"]);
  });

  it("returns null when nothing is offered, and survives random() near 1", () => {
    expect(randomScenario([], isScenario, () => 0.5)).toBeNull();
    expect(randomBox(shelves, isScenario, () => 0.9999999)?.id).toBe("mod");
  });
});
