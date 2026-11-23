import { describe, expect, test } from "vitest";
import { offeredPicks, poolPickRowsOf } from "./pool-pick-rows.js";

const PACKS = [
  { id: "core", name: "Core Set", group: "Core" },
  { id: "gob", name: "Green Goblin", group: "Wave 1" },
  { id: "wak", name: "Wakanda", group: "Wave 1" },
];

describe("pack and wave picker rows (issue #977)", () => {
  test("packs sit under a heading per wave, ticked when chosen", () => {
    expect(poolPickRowsOf(PACKS, ["wak"])).toEqual([
      { kind: "heading", text: "Core" },
      { kind: "choice", id: "core", name: "Core Set", selected: false },
      { kind: "heading", text: "Wave 1" },
      { kind: "choice", id: "gob", name: "Green Goblin", selected: false },
      { kind: "choice", id: "wak", name: "Wakanda", selected: true },
    ]);
  });

  test("waves have no headings", () => {
    expect(poolPickRowsOf([{ id: "core", name: "Core" }], null)).toEqual([
      { kind: "choice", id: "core", name: "Core", selected: false },
    ]);
  });

  test("a pick the pool no longer offers is dropped, and the rest keep the list's order", () => {
    expect(offeredPicks(["wak", "gone", "core"], PACKS)).toEqual(["core", "wak"]);
  });
});
