import { describe, expect, it } from "vitest";
import {
  action,
  addCounters,
  dealHiddenPiles,
  gainFromHiddenPile,
  hiddenPileCount,
  ifThen,
  revealHiddenPile,
  revealedPileCardCount,
  setup,
  valueAtLeast,
  varAtLeast,
} from "./index.js";
import { validateDefinition } from "./validate.js";

/**
 * docs/phase7-wave9.md §3.29 (a): hidden piles. `dealHiddenPiles` (MC50 p. 5, "Preparing the Evidence"),
 * `gainFromHiddenPile` (MC50 p. 18: gained cards are turned faceup), `revealHiddenPile` (MC50 p. 19) and the two
 * counts a script may read, `hiddenPileCount` and `revealedPileCardCount`.
 */
describe("§3.29 (a) hidden pile builders", () => {
  it("dealHiddenPiles names the set and the two piles, grouped by evidence kind", () => {
    expect(dealHiddenPiles("clues", { onePerGroupTo: "sealed", restTo: "open" })).toEqual({
      kind: "dealHiddenPiles",
      from: "clues",
      groupBy: "evidenceKind",
      onePerGroupTo: "sealed",
      restTo: "open",
    });
  });

  it("gainFromHiddenPile gains 1 card by default, a given count, and binds only when asked", () => {
    expect(gainFromHiddenPile("open")).toEqual({
      kind: "gainFromHiddenPile",
      pile: "open",
      count: { kind: "const", value: 1 },
    });
    expect(gainFromHiddenPile("open", 2, "got")).toEqual({
      kind: "gainFromHiddenPile",
      pile: "open",
      count: { kind: "const", value: 2 },
      bind: "got",
    });
  });

  it("revealHiddenPile names the pile, with a bind when asked", () => {
    expect(revealHiddenPile("sealed")).toEqual({ kind: "revealHiddenPile", pile: "sealed" });
    expect(revealHiddenPile("sealed", "shown")).toEqual({ kind: "revealHiddenPile", pile: "sealed", bind: "shown" });
  });

  it("the two counts", () => {
    expect(hiddenPileCount("open")).toEqual({ kind: "hiddenPileCount", pile: "open" });
    expect(revealedPileCardCount()).toEqual({ kind: "revealedPileCardCount" });
    expect(revealedPileCardCount("open")).toEqual({ kind: "revealedPileCardCount", pile: "open" });
  });
});

describe("§3.29 (a) hidden pile validation", () => {
  it("a Setup that deals, and an action that gains behind a size check and reads its bind, validate", () => {
    expect(validateDefinition(setup(dealHiddenPiles("clues", { onePerGroupTo: "sealed", restTo: "open" })))).toEqual(
      [],
    );
    const gain = action(
      ifThen(valueAtLeast(hiddenPileCount("open"), 1), gainFromHiddenPile("open", 2, "got")),
      ifThen(varAtLeast("got.count", 2), addCounters("found", 1)),
      revealHiddenPile("sealed", "shown"),
      ifThen(varAtLeast("shown.count", 3), addCounters("opened", 1)),
    );
    expect(validateDefinition(gain)).toEqual([]);
  });

  it("a bind that was never made is still caught: `<bind>.count` exists only after the gain that binds it", () => {
    const bad = action(gainFromHiddenPile("open", 2), ifThen(varAtLeast("got.count", 1), addCounters("found", 1)));
    expect(validateDefinition(bad).join("\n")).toContain("got.count");
  });

  it("a deal whose two piles are one pile, or with an empty name or set, is rejected", () => {
    const problems = (onePerGroupTo: string, restTo: string, from = "clues") =>
      validateDefinition(setup(dealHiddenPiles(from, { onePerGroupTo, restTo }))).join("\n");
    expect(problems("same", "same")).toContain("onePerGroupTo and restTo must be two different piles");
    expect(problems("", "open")).toContain("a pile has no name");
    expect(problems("sealed", "")).toContain("a pile has no name");
    expect(problems("sealed", "open", "")).toContain("names no encounter set to deal from");
  });

  it("a gain or a reveal with no pile name is rejected", () => {
    expect(validateDefinition(action(gainFromHiddenPile(""))).join("\n")).toContain(
      "gainFromHiddenPile: the pile has no name",
    );
    expect(validateDefinition(action(revealHiddenPile(""))).join("\n")).toContain(
      "revealHiddenPile: the pile has no name",
    );
  });

  it.each([0, -1, 1.5])("a constant gain of %s cards is rejected", (count) => {
    expect(validateDefinition(action(gainFromHiddenPile("open", count))).join("\n")).toContain(
      "gainFromHiddenPile: a constant count must be a whole number of at least 1",
    );
  });
});
