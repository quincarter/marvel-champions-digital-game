/**
 * docs/phase7-wave9.md §3.46 (a): `oncePerPaidCard` / `limitPerPaidCard`, "Resource: Remove 1 bird counter from here →
 * generate a [energy] resource for an Aerial card. (Limit once per card.)" The engine's `limit-per-paid-card.test.ts`
 * drives the plain data.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { action, limitPerPaidCard, oncePerPaidCard, removeCounter, resource } from "./abilities.js";
import { validateDefinition } from "./validate.js";

const AERIAL = { trait: trait("AERIAL") };

describe("§3.46 (a) `oncePerPaidCard` and `limitPerPaidCard`", () => {
  it("is a limit counted per card paid for", () => {
    expect(oncePerPaidCard).toEqual({ count: 1, period: "round", per: "paidCard" });
    expect(limitPerPaidCard(2)).toEqual({ count: 2, period: "round", per: "paidCard" });
  });

  it("builds a resource ability with a counter cost that generates for a kind of card, once per card", () => {
    const definition = resource(
      { energy: 1 },
      { cost: removeCounter("bird"), generatesFor: AERIAL, repeatable: true, limit: oncePerPaidCard },
    );
    expect(definition).toMatchObject({
      trigger: { kind: "resource", repeatable: true },
      cost: { spendCounters: { counterType: "bird", amount: 1 } },
      generates: { energy: 1 },
      generatesFor: AERIAL,
      limit: { count: 1, period: "round", per: "paidCard" },
    });
    expect(validateDefinition(definition)).toEqual([]);
    // Without `repeatable` it is valid too: one use per payment either way.
    const plain = resource(
      { energy: 1 },
      { cost: removeCounter("bird"), generatesFor: AERIAL, limit: oncePerPaidCard },
    );
    expect(validateDefinition(plain)).toEqual([]);
  });

  it("validates: a resource ability's limit, repeatable above 1, and still the only limit a repeatable one takes", () => {
    const problems = (definition: ReturnType<typeof resource>) => validateDefinition(definition).join("\n");
    expect(problems(action({ limit: oncePerPaidCard }))).toMatch(/limit per card paid for is a resource ability's/);
    expect(problems(resource(1, { cost: removeCounter("bird"), limit: limitPerPaidCard(2) }))).toMatch(
      /must be repeatable/,
    );
    expect(problems(resource(1, { cost: removeCounter("bird"), repeatable: true, limit: limitPerPaidCard(2) }))).toBe(
      "",
    );
    expect(
      problems(resource(1, { cost: removeCounter("bird"), repeatable: true, limit: { count: 1, period: "round" } })),
    ).toMatch(/a repeatable resource ability needs/);
  });
});
