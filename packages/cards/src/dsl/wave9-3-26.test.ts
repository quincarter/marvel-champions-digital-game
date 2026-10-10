/**
 * docs/phase7-wave9.md §3.26, §4.1 Q1 = A (the owner's answer of 2026-10-10): the DSL side of a flip to another card
 * type that keeps named counters (`flipCard(…, { keepCounters })`), the Board Member environments' "If there are 4 or
 * more secret counters here (3 or more instead in expert mode), flip this card." (Chief Medical Officer, `aos` 50181a).
 * RRG 1.8 "Flip" (p. 20) discards every token on a change of card type; MC50 pp. 11 and 19 count the secret counters on
 * a Board Member that has become an attachment. The engine's `flip-keep-counters.test.ts` drives the same shape.
 */

import { describe, expect, it } from "vitest";
import { stateCheck } from "./abilities.js";
import { flipCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosenPlayer, countersOn, ifElse, inMode, self, valueAtLeast } from "./values.js";

describe("§3.26 flipCard keepCounters", () => {
  it("names the counter types the card keeps through a change of card type", () => {
    expect(flipCard(self, { keepCounters: ["secret"] })).toEqual({
      kind: "flipCard",
      target: { kind: "self" },
      keepCounters: ["secret"],
    });
  });

  it("an empty list, or none, is the plain flip", () => {
    expect(flipCard(self, { keepCounters: [] })).toEqual({ kind: "flipCard", target: { kind: "self" } });
    expect(flipCard(self)).toEqual({ kind: "flipCard", target: { kind: "self" } });
  });

  it("goes with the other options, and copies the list it is given", () => {
    const types = ["secret"];
    const effect = flipCard(self, { controller: chosenPlayer("who"), keepCounters: types });
    expect(effect).toMatchObject({
      kind: "flipCard",
      controller: { kind: "slot", slot: "who" },
      keepCounters: ["secret"],
    });
    expect((effect as { keepCounters: readonly string[] }).keepCounters).not.toBe(types);
  });

  it("a Board Member environment: a state check at 4 secret counters, 3 in expert mode", () => {
    const definition = stateCheck(
      valueAtLeast(countersOn(self, "secret"), ifElse(inMode("expert"), 3, 4)),
      flipCard(self, { keepCounters: ["secret"] }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({ kind: "stateCheck" });
    expect(definition.effects).toEqual([{ kind: "flipCard", target: { kind: "self" }, keepCounters: ["secret"] }]);
  });
});
