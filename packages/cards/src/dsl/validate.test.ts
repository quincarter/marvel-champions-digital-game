import type { AbilityDefinition } from "@mc/engine";
import { action, discardFromHandCost, exhaustCardsCost, returnToHandCost } from "./abilities.js";
import { dealDamage, draw } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { handCountOf, query, scaled, varOf } from "./values.js";

const drawN = draw(varOf("n"));

describe("validateDefinition: costs paid with cards in play", () => {
  it("accepts a fixed pick and an \"any number\" pick, binding the slot and count", () => {
    expect(validateDefinition(action({ cost: exhaustCardsCost(query("upgrade", { name: "Shield" })) }, draw(1)))).toEqual([]);
    expect(validateDefinition(action({ cost: exhaustCardsCost(query("ally"), { max: "any", bind: "n" }) }, drawN))).toEqual([]);
    expect(exhaustCardsCost(query("ally"), { max: "any" }).exhaustCards).toEqual({ slot: "exhausted", query: { categories: ["ally"] }, min: 1 });
    expect(returnToHandCost(query("upgrade")).returnToHand).toEqual({ slot: "returned", query: { categories: ["upgrade"] }, min: 1, max: 1 });
  });

  it("rejects min 0: \"any number\" and \"up to\" still need one card (RRG 1.8 \"Cost\", p. 14)", () => {
    const problems = validateDefinition(action({ cost: exhaustCardsCost(query("ally"), { min: 0, max: "any", bind: "n" }) }, drawN));
    expect(problems.join("\n")).toMatch(/exhaustCards: min must be a whole number of at least 1/);
  });

  it("rejects max below min, and two cost components picking into the same slot", () => {
    expect(validateDefinition(action({ cost: returnToHandCost(query("upgrade"), { min: 2, max: 1 }) }, draw(1))).join("\n")).toMatch(/max must be/);
    const clash = action({ cost: [exhaustCardsCost(query("ally"), { slot: "picked" }), returnToHandCost(query("upgrade"), { slot: "picked" })] }, draw(1));
    expect(validateDefinition(clash).join("\n")).toMatch(/same slot/);
  });

  it("keeps min 0 legal for discard X, where X is the player's choice", () => {
    expect(validateDefinition(action({ cost: discardFromHandCost(0, undefined, "x") }, draw(varOf("x"))))).toEqual([]);
  });
});

describe("validateDefinition: scaled.divide", () => {
  it("accepts an explicit rounding direction and rejects a missing one or a divisor below 1 (RRG 1.8 p. 29 rounds up by default)", () => {
    expect(validateDefinition(action(draw(scaled(handCountOf(), { divide: { by: 2, round: "down" } }))))).toEqual([]);
    const noRound = action(draw({ kind: "scaled", value: handCountOf(), divide: { by: 2 } } as never)) as AbilityDefinition;
    expect(validateDefinition(noRound).join("\n")).toMatch(/divide.round must be/);
    expect(validateDefinition(action(draw(scaled(handCountOf(), { divide: { by: 0, round: "up" } })))).join("\n")).toMatch(/divide.by must be/);
  });
});

describe("validateDefinition: superlative's per-candidate slot", () => {
  const highestCost = (slot?: string) => ({
    kind: "superlative",
    among: { kind: "each", query: query("upgrade") },
    order: "highest",
    measure: { kind: "printedCost", of: { kind: "slot", slot: slot ?? "candidate" } },
    ...(slot ? { slot } : {}),
  });

  it("lets measure read the candidate slot (default or named) without an ability binding it (Burn Notice, Clash of the Titans)", () => {
    expect(validateDefinition(action({}, dealDamage(1, highestCost() as never)))).toEqual([]);
    expect(validateDefinition(action({}, dealDamage(1, highestCost("pick") as never)))).toEqual([]);
  });

  it("still rejects the candidate slot read anywhere outside measure", () => {
    const problems = validateDefinition(action({}, dealDamage(1, { kind: "slot", slot: "candidate" } as never)));
    expect(problems.join("\n")).toMatch(/slot "candidate" is read before it is bound/);
  });
});
