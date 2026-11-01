import { NEBULAS_SHIP_GUARD_ABILITY } from "../../campaigns/gmw-balanced.js";
import { GMW_ABILITIES } from "./index.js";

/**
 * Balanced house rule, issue #609, Gideon's Gaming. The behavior is driven through a real campaign game in
 * `campaigns/gmw-balanced*.test.ts`; this pins the one registry-only ability the Balanced Nebula scenario rule grants
 * (`16093.balanced-evasion-guard`), which is on no card, so it is not a data ref.
 */
describe("16093.balanced-evasion-guard (registry-only, granted to Nebula's Ship by a scenario rule)", () => {
  it("is registered as a Forced Response limited to once per round, only while the ship has a counter", () => {
    expect(NEBULAS_SHIP_GUARD_ABILITY).toBe("16093.balanced-evasion-guard");
    const definition = GMW_ABILITIES[NEBULAS_SHIP_GUARD_ABILITY];
    expect(definition).toBeDefined();
    expect(definition?.trigger).toMatchObject({
      kind: "response",
      forced: true,
      on: { on: "dealDamage", fromAttack: true, eventAtLeast: { taken: 3 } },
      while: { kind: "compare", op: "atLeast" },
    });
    expect(definition?.limit).toEqual({ count: 1, period: "round" });
  });
});
