import type { AbilityDefinition } from "@mc/engine";
import { action, discardFromHandCost, discardRandomFromHandCost, discardThis, exhaustCardsCost, returnToHandCost } from "./abilities.js";
import { dealDamage, draw } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { countOf, each, handCountOf, query, scaled, sum, varOf } from "./values.js";

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

describe("validateDefinition: wave 1 batch costs and values", () => {
  const minions = each(query("minion"));

  it("a discard-random-from-hand cost needs a whole number of at least 1 (Magic Crowbar)", () => {
    expect(discardRandomFromHandCost()).toEqual({ discardRandomFromHand: 1 });
    expect(validateDefinition(action({ cost: discardRandomFromHandCost(1) }, draw(1)))).toEqual([]);
    expect(validateDefinition(action({ cost: discardRandomFromHandCost(0) }, draw(1))).join("\n")).toMatch(/discardRandomFromHand: must be a whole number/);
  });

  it("a discard-self cost makes self.threat and self.damage readable (Beat Cop), and nothing else does", () => {
    expect(validateDefinition(action({ cost: discardThis }, dealDamage(varOf("self.threat"), minions)))).toEqual([]);
    expect(validateDefinition(action({ cost: discardThis }, dealDamage(varOf("self.damage"), minions)))).toEqual([]);
    expect(validateDefinition(action(dealDamage(varOf("self.threat"), minions))).join("\n")).toMatch(/var "self.threat" is read before it is bound/);
  });

  it("rejects an empty sum or anyTrait, and accepts a real one (Generation Why?, Morphogenetics)", () => {
    expect(sum(1, countOf(query("ally")))).toEqual({ kind: "sum", values: [{ kind: "const", value: 1 }, { kind: "count", query: { categories: ["ally"] } }] });
    expect(validateDefinition(action(draw(sum(countOf(query("ally")), countOf(query("support"))))))).toEqual([]);
    expect(validateDefinition(action(draw(sum()))).join("\n")).toMatch(/sum needs at least one value/);
    expect(validateDefinition(action(dealDamage(1, each(query("minion", { anyTrait: [] }))))).join("\n")).toMatch(/anyTrait needs at least one trait/);
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
