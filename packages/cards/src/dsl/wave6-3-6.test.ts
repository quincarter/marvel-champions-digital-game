/**
 * docs/phase7-wave6.md §3.6: `discardStatusCost` (Made of Rage, `mut_gen` 32007: "discard a tough status card from your
 * hero →") and `removeStatus(target, status, { count, bind })` (Homesick, 32025; Steel Fist, 32008). The engine side is
 * driven by `packages/engine/src/status-discard-cost.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { action, discardStatusCost } from "./abilities.js";
import { draw, ifThen, removeStatus } from "./effects.js";
import { yourIdentity } from "./values.js";
import { validateDefinition } from "./validate.js";

describe("§3.6 `discardStatusCost`", () => {
  it("Made of Rage's shape: discard a tough status card from your hero →", () => {
    const definition = action({ cost: discardStatusCost("tough", yourIdentity) }, draw(1));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.cost).toEqual({ discardStatus: { status: "tough", from: yourIdentity } });
  });
});

describe("§3.6 `removeStatus` options", () => {
  it("bare: every card of that type, nothing bound", () => {
    expect(removeStatus(yourIdentity, "tough")).toEqual({
      kind: "removeStatus",
      target: yourIdentity,
      status: "tough",
    });
  });

  it("Homesick's shape: `<bind>.amount` read by a later effect validates", () => {
    const definition = action(
      removeStatus(yourIdentity, "tough", { bind: "discarded" }),
      ifThen(
        {
          kind: "compare",
          left: { kind: "var", name: "discarded.amount" },
          op: "equalTo",
          right: { kind: "const", value: 0 },
        },
        draw(1),
      ),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[0]).toEqual({
      kind: "removeStatus",
      target: yourIdentity,
      status: "tough",
      bind: "discarded",
    });
  });

  it("Steel Fist's shape: `count: 1`; a count below 1 is refused", () => {
    expect(removeStatus(yourIdentity, "tough", { count: 1 })).toEqual({
      kind: "removeStatus",
      target: yourIdentity,
      status: "tough",
      count: 1,
    });
    expect(validateDefinition(action(removeStatus(yourIdentity, "tough", { count: 0 })))).not.toEqual([]);
  });
});
