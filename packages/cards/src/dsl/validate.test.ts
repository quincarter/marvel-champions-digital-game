import type { AbilityDefinition } from "@mc/engine";
import { action, boost, discardFromHandCost, discardRandomFromHandCost, discardThis, exhaustCardsCost, returnToHandCost, whenRevealed } from "./abilities.js";
import { ANY_RESOURCE, cards, chooseOne, dealDamage, discardDeckUntil, discardFromHand, draw, encounterCards, enemyAttack, enemyScheme, giveBoostCard, moveCards, selectCards } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, countOf, defendingCharacter, each, eachPlayer, handCountOf, query, scaled, sum, theVillain, varOf, you } from "./values.js";

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

describe("giveBoostCard: a facedown boost card outside an activation (Hired Gun, Intimidation)", () => {
  it("defaults to one card for the villain, and omits the count when it is 1", () => {
    expect(giveBoostCard()).toEqual({ kind: "giveBoostCard", enemy: { kind: "villain" } });
    expect(giveBoostCard(each(query("minion")), 2)).toEqual({ kind: "giveBoostCard", enemy: { kind: "each", query: { categories: ["minion"] } }, count: { kind: "const", value: 2 } });
    expect(validateDefinition(whenRevealed(giveBoostCard()))).toEqual([]);
  });

  it("is rejected inside a Boost ability, where the printed shape is 'for this activation' (modifyAttack), even nested", () => {
    expect(validateDefinition(boost(giveBoostCard())).join("\n")).toMatch(/inside a Boost ability use modifyAttack/);
    const nested = boost(chooseOne({ label: "give", effects: [giveBoostCard()] }));
    expect(validateDefinition(nested).join("\n")).toMatch(/inside a Boost ability/);
  });

  it("rejects a constant count below 1", () => {
    expect(validateDefinition(whenRevealed(giveBoostCard(undefined, 0))).join("\n")).toMatch(/count must be a whole number of at least 1/);
  });
});

describe("anyPrintedResource: a card printing any of several resource types (Tombstone)", () => {
  it("accepts a non-empty list in a zone filter and rejects an empty one", () => {
    const tossFrom = (types: readonly ("mental" | "physical")[]) => action({}, dealDamage(countOf(query("resource", { anyPrintedResource: types })), each(query("villain"))));
    expect(validateDefinition(tossFrom(["mental", "physical"]))).toEqual([]);
    expect(validateDefinition(tossFrom([])).join("\n")).toMatch(/anyPrintedResource needs at least one resource type/);
  });
});

describe("defendingCharacter: the defender of the attack in progress (Energy Projectiles)", () => {
  it("is a plain ref a Boost ability can target without binding anything", () => {
    expect(defendingCharacter).toEqual({ kind: "defendingCharacter" });
    expect(validateDefinition(boost(dealDamage(1, defendingCharacter)))).toEqual([]);
  });
});

describe("wave 1 closing batch: the three new builders", () => {
  it("`discardDeckUntil` binds its slot and `<bind>.count` for the effects that follow (Teen Spirit)", () => {
    const teenSpirit = action(
      discardDeckUntil(query("ally", { identitySetOf: you }), "found"),
      moveCards(cards(chosen("found")), "hand"),
      draw(varOf("found.count")),
    );
    expect(validateDefinition(teenSpirit)).toEqual([]);
    expect(discardDeckUntil(query("ally"), "found")).toEqual({
      kind: "discardDeckUntil",
      player: you,
      filter: { categories: ["ally"] },
      bind: "found",
    });
    // The slot is only readable after it is bound.
    expect(validateDefinition(action(moveCards(cards(chosen("found")), "hand"))).join("\n")).toMatch(/slot "found"/);
  });

  it("`discardFromHand` takes a filter, and `ANY_RESOURCE` is the four printed resource types (Power Drain)", () => {
    expect(ANY_RESOURCE).toEqual({ anyPrintedResource: ["physical", "mental", "energy", "wild"] });
    // `discardEncounterCards` and its summed `<bind>.boostIcons` live in `wave1/gob/local.ts`, so the live count is
    // stood in for here by any other bound var; what matters is that the filter and the live amount validate together.
    const powerDrain = action(
      selectCards("pd", encounterCards(["discard"])),
      discardFromHand(varOf("pd.count"), eachPlayer, { filter: ANY_RESOURCE }),
    );
    expect(validateDefinition(powerDrain)).toEqual([]);
    expect(discardFromHand(1, eachPlayer, { filter: ANY_RESOURCE })).toEqual({
      kind: "discardFromHand",
      player: eachPlayer,
      amount: { kind: "const", value: 1 },
      filter: ANY_RESOURCE,
    });
  });

  it("`enemyAttack`/`enemyScheme` carry a bonus scoped to the activation they start (Death from Above)", () => {
    const stageNumber = { kind: "villainStageNumber", of: theVillain } as const;
    expect(enemyAttack(theVillain, { against: you, atkBonus: stageNumber })).toEqual({
      kind: "enemyAttack",
      enemies: theVillain,
      against: you,
      atkBonus: stageNumber,
    });
    expect(enemyScheme(theVillain, { against: you, schBonus: 2 })).toEqual({
      kind: "enemyScheme",
      enemies: theVillain,
      against: you,
      schBonus: { kind: "const", value: 2 },
    });
    expect(validateDefinition(whenRevealed(enemyAttack(theVillain, { against: you, atkBonus: stageNumber })))).toEqual([]);
  });
});
