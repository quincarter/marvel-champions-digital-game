import { describe, expect, it } from "vitest";
import { option, spendResources } from "./index.js";

/**
 * `option()`'s spends are `required` (paid in full once chosen). Whether an unpayable option is offered is the engine's
 * call from the source card (`executeChooseOne`): an encounter card's is (RRG 1.8 "Choose (Option)", p. 12; owner
 * decision 2026-10-20 (A), reversing wave 7 Q8 and wave 9 Q33), a player card's is not.
 */
describe("option(): a spend among the option's own effects", () => {
  it("is made required and carries no per-card flag", () => {
    const built = option("Spend 1 resource of any type", spendResources({ generic: 1 }, "spent"));
    expect(built.effects).toEqual([expect.objectContaining({ kind: "spendResources", required: true })]);
    expect(built.effects[0]).not.toHaveProperty("payIfAble");
    expect(built.condition).toBeUndefined();
  });
});
