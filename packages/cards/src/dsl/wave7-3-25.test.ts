/**
 * docs/phase7-wave7.md §3.25 items 3–5: "[star] X's base THW and base ATK are equal to the THW and ATK of your hero."
 * (`baseStatsFromYourHero`), "If X leaves play, the players lose the game." (`leavingPlayLoses`), a value reading a
 * character's base stat (`baseStatOf`), and the redirect "When [villain] attacks, he attacks X instead." written with
 * the existing `retargetAttack`. The engine's `hero-stat-ally.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { baseStatsFromYourHero, constant, rule, forcedInterrupt, leavingPlayLoses } from "./abilities.js";
import { retargetAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { baseStatOf, isHero, named, printedStatOf, self, statOf } from "./values.js";

describe("§3.25 base THW and ATK from your hero", () => {
  const fromHero = (stat: "atk" | "thw") => ({
    stat,
    amount: { kind: "stat", of: { kind: "identityOf", player: { kind: "controller" } }, stat },
    target: { self: true },
    while: { kind: "form", player: { kind: "controller" }, form: "hero" },
    setBase: true,
  });

  it("compiles to two base overrides on this card, read from the controller's hero, only in hero form (Q14 = B)", () => {
    expect(baseStatsFromYourHero()).toEqual({ modifiers: [fromHero("thw"), fromHero("atk")] });
    expect(baseStatsFromYourHero().modifiers?.[0]?.while).toEqual(isHero());
  });

  it("one stat alone", () => {
    expect(baseStatsFromYourHero("atk")).toEqual({ modifiers: [fromHero("atk")] });
  });

  it("the whole constant ability validates", () => {
    const definition = constant(
      rule({ kind: "controlledByFirstPlayer", target: { self: true } }),
      baseStatsFromYourHero(),
      leavingPlayLoses({ self: true }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      modifiers: [fromHero("thw"), fromHero("atk")],
      rules: [
        { kind: "controlledByFirstPlayer", target: { self: true } },
        { kind: "leavingPlayLoses", target: { self: true } },
      ],
    });
  });
});

describe("§3.25 'If X leaves play, the players lose the game.'", () => {
  it("compiles to the engine's rule, with an optional condition", () => {
    expect(leavingPlayLoses({ self: true })).toEqual({ rules: [{ kind: "leavingPlayLoses", target: { self: true } }] });
    expect(leavingPlayLoses({ name: "Ward" }, { while: isHero() })).toEqual({
      rules: [{ kind: "leavingPlayLoses", target: { name: "Ward" }, while: isHero() }],
    });
  });
});

describe("§3.25 a base stat as a value", () => {
  it("is the stat value marked base, beside the current and printed readings", () => {
    expect(baseStatOf(self, "atk")).toEqual({ kind: "stat", of: { kind: "self" }, stat: "atk", base: true });
    expect(statOf(self, "atk")).toEqual({ kind: "stat", of: { kind: "self" }, stat: "atk" });
    expect(printedStatOf(self, "atk")).toEqual({ kind: "stat", of: { kind: "self" }, stat: "atk", printed: true });
  });
});

describe("§3.25 'When [villain] attacks, he attacks X instead.'", () => {
  it("is a forced interrupt to the villain's attack with retargetAttack", () => {
    const definition = forcedInterrupt(
      { on: "enemyAttack", sourceIs: { categories: ["villain"] } },
      retargetAttack(named("Ward")),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([{ kind: "retargetAttack", character: { kind: "named", name: "Ward" } }]);
  });
});
