/**
 * `divide("heal", …)`: "heal 3 damage from among characters you control" (Compassion, `mut_gen` 32182). The engine's
 * `divide-heal.test.ts` drives it. Shapes and validation only.
 */

import { describe, expect, it } from "vitest";
import { alterEgoResponse, on } from "./abilities.js";
import { divide, draw, ifThen } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { query, valueAtLeast, varOf, YOUR_IDENTITY } from "./values.js";

const yours = query("character", { controller: "you" });

describe("divide heal", () => {
  it("builds a heal division, chosen by you unless said otherwise", () => {
    expect(divide("heal", 3, yours)).toEqual({
      kind: "divide",
      what: "heal",
      amount: { kind: "const", value: 3 },
      among: { categories: ["character"], controller: "you" },
      chooser: { kind: "controller" },
    });
    expect(divide("heal", 3, yours, { upTo: true, bind: "healed" })).toMatchObject({ upTo: true, bind: "healed" });
  });

  it("Compassion's shape validates, and `<bind>.amount` is readable after it", () => {
    const recover = { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } } as const;
    expect(validateDefinition(alterEgoResponse(recover, divide("heal", 3, yours), draw(1)))).toEqual([]);
    const bound = alterEgoResponse(
      recover,
      divide("heal", 3, yours, { bind: "healed" }),
      ifThen(valueAtLeast(varOf("healed.amount"), 1), draw(1)),
    );
    expect(validateDefinition(bound)).toEqual([]);
  });
});
