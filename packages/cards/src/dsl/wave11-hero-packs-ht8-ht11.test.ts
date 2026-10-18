/**
 * docs/phase7-wave11-hero-packs.md H3.5 (HT8: a counter cost read off a card chosen with the cost, 4K Digital Camcorder
 * 61009) and H3.16 (HT11: a deck search played "as if it were in your hand", Calling in Favors 61008, Q102 = A): the
 * DSL's vocabulary and its validation. The engine's `counter-cost-read-from-target.test.ts` and
 * `play-from-deck-as-if-in-hand.test.ts` drive the behavior.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { action, chooseTargetCost, exhaustThis, removeCounter, removeUpToCounters, resource } from "./abilities.js";
import { discard, playFromDeckReducingCost } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, named, query, remainingHpOf, sum } from "./values.js";

const nonElite = { ...query("minion"), withoutTrait: trait("Elite") };
const x = sum(remainingHpOf(chosen("minion")), -2);

describe("HT8: a counter cost whose amount is read from the board", () => {
  it("`removeCounter` takes a value, and `chooseTargetCost` binds the pick it reads", () => {
    expect(removeCounter("evidence", x, { from: named("Alias Investigations") })).toEqual({
      spendCounters: { counterType: "evidence", amount: x, target: { kind: "named", name: "Alias Investigations" } },
    });
    expect(chooseTargetCost(nonElite, "minion")).toEqual({ chooseTarget: { slot: "minion", query: nonElite } });
    expect(removeCounter("evidence")).toEqual({ spendCounters: { counterType: "evidence", amount: 1 } });
  });

  it("the Camcorder's shape validates; the pick's slot is readable in the effects", () => {
    const camcorder = action(
      {
        cost: [
          exhaustThis,
          chooseTargetCost(nonElite, "minion"),
          removeCounter("evidence", x, { from: named("Alias Investigations") }),
        ],
      },
      discard(chosen("minion")),
    );
    expect(validateDefinition(camcorder)).toEqual([]);
  });

  it("refused: a read amount with 'up to', on a repeatable resource ability, and a chosen card outside an action", () => {
    const upTo = removeUpToCounters("evidence", 3, { bind: "n" });
    const readUpTo = action(
      { cost: { spendCounters: { ...upTo.spendCounters!, amount: x } } },
      discard(chosen("minion")),
    );
    expect(validateDefinition(readUpTo).join("\n")).toContain("an amount read from the board is a fixed X");
    const looped = resource(1, { cost: removeCounter("evidence", x), repeatable: true });
    expect(validateDefinition(looped).join("\n")).toContain("needs a fixed spendCounters cost");
    const asResource = resource(1, { cost: chooseTargetCost(nonElite, "minion") });
    expect(validateDefinition(asResource).join("\n")).toContain("cost chooseTarget: only on an action");
  });
});

describe("HT11: a deck search played as if it were in your hand", () => {
  it("`playFromDeckReducingCost` with `asIfInHand` marks the deck play; without it the play is unchanged", () => {
    expect(playFromDeckReducingCost(2, undefined, { filter: query("ally"), asIfInHand: true })).toMatchObject({
      kind: "playFromHand",
      from: { deck: "search", asIfInHand: true },
      costReduction: { kind: "const", value: 2 },
    });
    expect(playFromDeckReducingCost(2)).toMatchObject({ from: "deck" });
    expect(validateDefinition(action(playFromDeckReducingCost(2, undefined, { asIfInHand: true })))).toEqual([]);
  });
});
