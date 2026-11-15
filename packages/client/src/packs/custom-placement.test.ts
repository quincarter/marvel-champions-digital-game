import { afterEach, describe, expect, it } from "vitest";
import { currentHeroShelfPacks } from "../content/pool.js";
import { setLoadedPacks } from "./pack-registry.js";
import type { PackRuntime } from "./pack-runtime.js";
import { CUSTOM_SHELF_ID, placeHeroShelfPacks, placeScenarioShelves } from "./custom-placement.js";

const official = [
  { code: "core", cycleId: "core", cycleName: "Core Set", cycleOrder: 0 },
  { code: "gob", cycleId: "cycle1", cycleName: "Rise of Red Skull", cycleOrder: 2 },
  { code: "msm", cycleId: "cycle1", cycleName: "Rise of Red Skull", cycleOrder: 2 },
];
const packs = [
  { id: "carnage-nep", codes: ["carnage"], wave: "cycle1" },
  { id: "yondu-dh", codes: ["yondu-dh"] },
];

describe("placeHeroShelfPacks (issue #734)", () => {
  it("puts every pack on the Custom packs shelf after the last wave at the bottom", () => {
    const placed = placeHeroShelfPacks(official, packs, "bottom").slice(official.length);
    expect(placed.map((p) => [p.code, p.cycleId, p.cycleOrder])).toEqual([
      ["carnage-nep", CUSTOM_SHELF_ID, 3],
      ["carnage", CUSTOM_SHELF_ID, 3],
      ["yondu-dh", CUSTOM_SHELF_ID, 3],
    ]);
  });

  it("puts that shelf before the first wave at the top", () => {
    const placed = placeHeroShelfPacks(official, packs, "top").slice(official.length);
    expect(placed.every((p) => p.cycleId === CUSTOM_SHELF_ID && p.cycleOrder === -1)).toBe(true);
  });

  it("mixes a pack in beside the wave it names, after the wave's own packs; one naming none stays at the bottom", () => {
    const placed = placeHeroShelfPacks(official, packs, "mixed").slice(official.length);
    expect(placed.map((p) => [p.code, p.cycleId, p.cycleOrder, p.releaseDate])).toEqual([
      ["carnage-nep", "cycle1", 2, "9999"],
      ["carnage", "cycle1", 2, "9999"],
      ["yondu-dh", CUSTOM_SHELF_ID, 3, undefined],
    ]);
  });

  it("leaves a wave the game does not know at the bottom, and the official list alone with no packs", () => {
    const placed = placeHeroShelfPacks(official, [{ id: "x", codes: [], wave: "cycle99" }], "mixed");
    expect(placed.at(-1)!.cycleId).toBe(CUSTOM_SHELF_ID);
    expect(placeHeroShelfPacks(official, [], "mixed")).toBe(official);
  });
});

describe("placeScenarioShelves (issue #734)", () => {
  const products = [
    { code: "core", cycleId: "core" },
    { code: "trors", cycleId: "cycle1" },
    { code: "toafk", cycleId: "cycle2" },
  ];

  it("puts the Custom packs shelf last, or first", () => {
    expect(placeScenarioShelves(products, "bottom").order).toEqual(["core", "trors", "toafk", CUSTOM_SHELF_ID]);
    expect(placeScenarioShelves(products, "top").order).toEqual([CUSTOM_SHELF_ID, "core", "trors", "toafk"]);
  });

  it("mixes a scenario in on its wave's last product only when mixed", () => {
    expect(placeScenarioShelves(products, "mixed").shelfOf("cycle1")).toBe("trors");
    expect(placeScenarioShelves(products, "mixed").shelfOf(undefined)).toBe(CUSTOM_SHELF_ID);
    expect(placeScenarioShelves(products, "mixed").shelfOf("nope")).toBe(CUSTOM_SHELF_ID);
    expect(placeScenarioShelves(products, "top").shelfOf("cycle1")).toBe(CUSTOM_SHELF_ID);
  });
});

describe("currentHeroShelfPacks follows the placement setting (issue #734)", () => {
  afterEach(() => setLoadedPacks([]));

  it("gives a different list for each placement of the same loaded packs", () => {
    setLoadedPacks([
      { id: "carnage-nep", wave: "cycle5", decks: [{ packCode: "carnage-nep" }] },
    ] as unknown as PackRuntime[]);
    const shelfOf = (placement: "top" | "bottom" | "mixed") =>
      currentHeroShelfPacks(placement).find((pack) => pack.code === "carnage-nep");
    expect(shelfOf("bottom")?.cycleId).toBe(CUSTOM_SHELF_ID);
    expect(shelfOf("mixed")?.cycleId).toBe("cycle5");
    expect(shelfOf("top")!.cycleOrder).toBeLessThan(shelfOf("bottom")!.cycleOrder);
    expect(shelfOf("bottom")?.cycleId).toBe(CUSTOM_SHELF_ID);
  });
});
