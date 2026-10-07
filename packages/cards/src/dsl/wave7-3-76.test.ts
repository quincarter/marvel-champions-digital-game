/**
 * docs/phase7-wave7.md §3.76: the DSL builder for "for each acceleration token on the main scheme", and the three
 * printed shapes composed from it and existing builders. The engine's `acceleration-tokens-value.test.ts` proves what
 * the value reads.
 */

import { describe, expect, it } from "vitest";
import { action, constant, draw, gets } from "./index.js";
import { defineAbilities } from "./validate.js";
import { accelerationTokensOn, host, min, product, theMainScheme } from "./values.js";

describe("§3.76 accelerationTokensOn", () => {
  it("compiles to the value", () => {
    expect(accelerationTokensOn(theMainScheme)).toEqual({ kind: "accelerationTokens", on: { kind: "mainScheme" } });
    expect(accelerationTokensOn(host)).toEqual({ kind: "accelerationTokens", on: { kind: "host" } });
  });

  it("'+1 THW and +1 ATK for each … (to a maximum of +3)', 'draws 1 card for each' and 'by 2 for each' validate", () => {
    const tokens = accelerationTokensOn(theMainScheme);
    const registry = defineAbilities({
      "99076.constant": constant(
        gets("thw", min(tokens, 3), { self: true }),
        gets("atk", min(tokens, 3), { self: true }),
      ),
      "99076.action": action(draw(tokens)),
      "99076.attached": constant(gets("targetThreat", product(2, accelerationTokensOn(host)), { hostOfSelf: true })),
    });
    const capped = { kind: "min", values: [tokens, { kind: "const", value: 3 }] };
    expect(registry["99076.constant"]?.trigger).toEqual({
      kind: "constant",
      modifiers: [
        { stat: "thw", amount: capped, target: { self: true } },
        { stat: "atk", amount: capped, target: { self: true } },
      ],
    });
    expect(registry["99076.action"]?.effects).toEqual([draw(tokens)]);
    expect(registry["99076.attached"]?.trigger).toMatchObject({
      modifiers: [
        {
          stat: "targetThreat",
          amount: {
            kind: "product",
            values: [
              { kind: "const", value: 2 },
              { kind: "accelerationTokens", on: host },
            ],
          },
        },
      ],
    });
  });
});
