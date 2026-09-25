/**
 * docs/phase7-wave4.md §3.51–§3.59: the DSL builders for The Hood's primitives. Each composition is the one the Hood
 * scripts use; this file proves each validates (a var a repeated effect binds may be read in its condition) and emits
 * exactly the plain data `packages/engine/src/hood-primitives.test.ts` drives.
 */

import { describe, expect, it } from "vitest";
import { boost, constant, forcedInterrupt, gainsIcon, gainsKeywordX, on, whenRevealed } from "./abilities.js";
import {
  bindTargets,
  dealDamage,
  enemyAttack,
  ifThen,
  increaseDamage,
  placeThreat,
  putIntoPlay,
  repeatWhile,
  resolveWhenRevealedOf,
  surge,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  anyOf,
  chosen,
  countOf,
  each,
  eventTarget,
  isConfused,
  isStunned,
  not,
  query,
  remainingHpOf,
  self,
  statOf,
  superlative,
  theVillain,
  varAtLeast,
  you,
} from "./values.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);

describe("§3.51 enemyAttack keywords", () => {
  it("Total Annihilation (24054): the attack carries overkill itself", () => {
    const ability = whenRevealed(enemyAttack(theVillain, { against: you, keywords: ["overkill"] }));
    valid(ability);
    expect(ability.effects[0]).toEqual({
      kind: "enemyAttack",
      enemies: { kind: "villain" },
      against: { kind: "controller" },
      keywords: ["overkill"],
    });
  });
});

describe("§3.52 increaseDamage; isStunned / isConfused", () => {
  it("Beast Mode (24014) and Controller (24024)", () => {
    const beast = forcedInterrupt(
      on.damage(query(["identity", "ally"])),
      ifThen(anyOf(isStunned(eventTarget), isConfused(eventTarget)), increaseDamage(1)),
    );
    valid(beast);
    expect(isStunned(eventTarget)).toEqual({
      kind: "hasStatus",
      of: { kind: "eventTarget" },
      status: "stunned",
      active: true,
    });
    const controller = forcedInterrupt(
      { on: "dealDamage", selfIs: "source", fromAttack: true },
      increaseDamage(statOf(eventTarget, "atk")),
    );
    valid(controller);
    expect(controller.effects[0]).toEqual({
      kind: "increaseDamage",
      amount: { kind: "stat", of: { kind: "eventTarget" }, stat: "atk" },
    });
  });
});

describe("§3.53 gainsKeywordX", () => {
  it("Mandrill (24016): retaliate X, X a live count", () => {
    const mandrill = constant(
      gainsKeywordX("retaliate", countOf(query("character", { hasStatus: "confused" })), { self: true }),
    );
    valid(mandrill);
    expect(mandrill.trigger).toEqual({
      kind: "constant",
      keywordGrants: [
        {
          keyword: { name: "retaliate", value: 0 },
          target: { self: true },
          value: { kind: "count", query: { categories: ["character"], hasStatus: "confused" } },
        },
      ],
    });
  });
});

describe("§3.54 repeatWhile", () => {
  it("Out for Blood (24023): the condition reads what the repeated effects bind", () => {
    const ability = whenRevealed(
      repeatWhile(
        varAtLeast("hit.defeated"),
        bindTargets(
          "fewest",
          superlative("lowest", each(query(["identity", "ally"])), remainingHpOf(chosen("candidate"))),
        ),
        dealDamage(1, chosen("fewest"), { bind: "hit" }),
      ),
    );
    valid(ability);
    expect(ability.effects[0]).toMatchObject({
      kind: "repeatWhile",
      while: { kind: "varAtLeast", name: "hit.defeated" },
    });
  });

  it("a condition reading a var nothing binds is still refused", () => {
    expect(
      validateDefinition(whenRevealed(repeatWhile(varAtLeast("nope.defeated"), placeThreat(1, self)))),
    ).not.toEqual([]);
  });
});

describe("§3.56 resolveWhenRevealedOf", () => {
  it("Citywide Crisis (24059) and a 'resolve this card's When Revealed' boost", () => {
    const crisis = whenRevealed(
      resolveWhenRevealedOf(each(query("sideScheme")), { bind: "resolved" }),
      ifThen(not(varAtLeast("resolved.count")), placeThreat(2, each(query("scheme")))),
    );
    valid(crisis);
    expect(crisis.effects[0]).toEqual({
      kind: "resolveSpecials",
      of: { kind: "each", query: { categories: ["sideScheme"] } },
      trigger: "whenRevealed",
      bind: "resolved",
    });
    valid(boost(resolveWhenRevealedOf(self)));
  });
});

describe("§3.57 gainsIcon", () => {
  it("Secret Lair (24061)", () => {
    const lair = constant(gainsIcon("acceleration", query("enemy")));
    valid(lair);
    expect(lair.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "gainsIcon", icon: "acceleration", target: { categories: ["enemy"] } }],
    });
  });
});

describe("§3.59 putIntoPlay bind", () => {
  it("Crime Pays (24042): '<bind>.count' is readable after it", () => {
    const pays = whenRevealed(
      putIntoPlay(chosen("x"), you, { bind: "entered" }),
      ifThen(not(varAtLeast("entered.count")), surge()),
    );
    // `x` is never bound here, so only that is reported; `entered.count` is known.
    expect(validateDefinition(pays)).toEqual([expect.stringContaining('slot "x"')]);
  });
});
