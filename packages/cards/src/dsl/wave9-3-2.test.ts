/**
 * docs/phase7-wave9.md §3.2: `preparation(...)` and `resolvePreparationsOf(...)`, the "Preparation" abilities of MC50
 * rulebook p. 9. The engine's `preparation.test.ts` drives the plain data.
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, preparation } from "./abilities.js";
import { placeThreat, resolvePreparationsOf, resolveSpecials } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, query, you } from "./values.js";

describe("§3.2 `preparation` and `resolvePreparationsOf`", () => {
  it("`preparation` builds an ability of trigger kind `preparation`", () => {
    const definition = preparation(placeThreat(1, { kind: "mainScheme" }));
    expect(definition.trigger).toEqual({ kind: "preparation" });
    expect(definition.effects).toHaveLength(1);
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("`resolvePreparationsOf` names the card by ref, with the resolving player and the bind when given", () => {
    expect(resolvePreparationsOf(chosen("top"))).toEqual({
      kind: "resolveSpecials",
      of: { kind: "slot", slot: "top" },
      trigger: "preparation",
    });
    expect(resolvePreparationsOf(chosen("top"), { bind: "prep", player: you })).toEqual({
      kind: "resolveSpecials",
      of: { kind: "slot", slot: "top" },
      trigger: "preparation",
      player: { kind: "controller" },
      bind: "prep",
    });
  });

  it("validates: the card is named with `of`, and `asIf` / `includeKeywords` are refused", () => {
    const problems = (extra: object) =>
      validateDefinition(
        forcedInterrupt({ on: "attack", selfIs: "target" }, {
          ...resolveSpecials(query("treachery")),
          trigger: "preparation",
          ...extra,
        } as ReturnType<typeof resolveSpecials>),
      ).join("\n");
    expect(problems({})).toMatch(/resolveSpecials preparation: name the card with `of`/);
    expect(problems({ asIf: { remainingHpAtLeast: 1 } })).toMatch(/`asIf` is not read for a Preparation ability/);
    expect(problems({ includeKeywords: true })).toMatch(/`includeKeywords` is for When Revealed abilities/);
    expect(
      validateDefinition(
        forcedInterrupt({ on: "attack", selfIs: "target" }, resolvePreparationsOf(chosen("top"), { bind: "prep" })),
      ).filter((problem) => problem.includes("preparation")),
    ).toEqual([]);
  });
});
