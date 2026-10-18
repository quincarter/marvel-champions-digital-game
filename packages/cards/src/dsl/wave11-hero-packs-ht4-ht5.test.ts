/**
 * docs/phase7-wave11-hero-packs.md H3.9 ("until the end of the player phase", Take a Stand 62015) and H3.10 (a stat
 * equal to the highest among the other characters, Purple Man 61031): the DSL's vocabulary. The engine's
 * `end-of-player-phase.test.ts` and `highest-stat-among.test.ts` drive the behavior.
 */

import { describe, expect, it } from "vitest";
import { constant, gets } from "./abilities.js";
import { applyRuleUntil, modifyStatOf } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { each, highestStatAmong } from "./values.js";

describe("H3.9 'until the end of the player phase'", () => {
  it("is a duration the stat and rule builders take", () => {
    expect(modifyStatOf("thw", 1, { categories: ["ally"], controller: "you" }, "endOfPlayerPhase")).toMatchObject({
      kind: "modifyStatUntil",
      until: "endOfPlayerPhase",
    });
    expect(
      applyRuleUntil({ kind: "cannotTakeDamage", target: { categories: ["villain"] } }, "endOfPlayerPhase"),
    ).toMatchObject({ kind: "applyRuleUntil", until: "endOfPlayerPhase" });
  });
});

describe("H3.10 the highest stat among characters in play", () => {
  it("defaults to every character in play", () => {
    expect(highestStatAmong(["sch", "thw"])).toEqual({
      kind: "highestStat",
      stats: ["sch", "thw"],
      among: { kind: "each", query: { categories: ["character"] } },
    });
    expect(highestStatAmong(["atk"], each({ categories: ["ally"] }))).toMatchObject({
      among: { kind: "each", query: { categories: ["ally"] } },
    });
  });

  it("as two base stats on the card, the constant ability validates", () => {
    const definition = constant(
      gets("sch", highestStatAmong(["sch", "thw"]), { self: true }, { setBase: true }),
      gets("atk", highestStatAmong(["atk"]), { self: true }, { setBase: true }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      modifiers: [
        { stat: "sch", amount: { kind: "highestStat" }, setBase: true },
        { stat: "atk", amount: { kind: "highestStat" }, setBase: true },
      ],
    });
  });
});
