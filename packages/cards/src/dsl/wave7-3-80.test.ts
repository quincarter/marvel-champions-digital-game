/**
 * docs/phase7-wave7.md §3.80: the DSL side of a resource card whose yield is computed (Montage 44007; Self Confidence,
 * Self Control, Self Preservation 44025–44027). The engine's `resource-yield.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { constant, thisCardGenerates } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import {
  accelerationTokensOn,
  damageOn,
  ifElse,
  min,
  theMainScheme,
  valueAtMost,
  valueEquals,
  yourIdentity,
} from "./values.js";

const sustained = { kind: "damage", of: { kind: "identityOf", player: { kind: "controller" } } };
const num = (value: number) => ({ kind: "const", value });

describe("§3.80 thisCardGenerates", () => {
  it("additional: 1 more [wild] for each acceleration token on the main scheme, to 3", () => {
    const part = thisCardGenerates({
      additional: { resource: "wild", amount: min(accelerationTokensOn(theMainScheme), 3) },
    });
    expect(part).toEqual({
      resourceMultiplier: {
        thisCardGenerates: true,
        additional: {
          resource: "wild",
          amount: { kind: "min", values: [{ kind: "accelerationTokens", on: { kind: "mainScheme" } }, num(3)] },
        },
      },
    });
    expect(validateDefinition(constant(part))).toEqual([]);
  });

  it("factor: triple with no damage sustained, double with less than 5, otherwise as printed", () => {
    const damage = damageOn(yourIdentity);
    const part = thisCardGenerates({
      factor: ifElse(valueEquals(damage, 0), 3, ifElse(valueAtMost(damage, 4), 2, 1)),
    });
    expect(part).toEqual({
      resourceMultiplier: {
        thisCardGenerates: true,
        factor: {
          kind: "conditional",
          if: { kind: "compare", left: sustained, op: "equalTo", right: num(0) },
          then: num(3),
          else: {
            kind: "conditional",
            if: { kind: "compare", left: sustained, op: "atMost", right: num(4) },
            then: num(2),
            else: num(1),
          },
        },
      },
    });
    expect(validateDefinition(constant(part))).toEqual([]);
  });

  it("a plain factor narrowed to one type, with an additional amount given as a number", () => {
    expect(thisCardGenerates({ additional: { resource: "energy", amount: 1 }, factor: 2, resource: "energy" })).toEqual(
      {
        resourceMultiplier: {
          thisCardGenerates: true,
          additional: { resource: "energy", amount: num(1) },
          factor: 2,
          resource: "energy",
        },
      },
    );
  });
});
