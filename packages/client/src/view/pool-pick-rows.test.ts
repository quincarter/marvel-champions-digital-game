import { describe, expect, test } from "vitest";
import { choicesWithPicks, poolPickRowsOf } from "./pool-pick-rows.js";

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

  test("a pick the pool doesn't offer now stays listed in release order, so it can be unticked (PR #980 review)", () => {
    const offered = [PACKS[0]!, PACKS[2]!];
    expect(choicesWithPicks(offered, ["wak"], PACKS)).toBe(offered);
    expect(choicesWithPicks(offered, null, PACKS)).toBe(offered);
    expect(choicesWithPicks(offered, ["gob"], PACKS).map((c) => c.id)).toEqual(["core", "gob", "wak"]);
  });
});
