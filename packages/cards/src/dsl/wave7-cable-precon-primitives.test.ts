/**
 * The DSL builders for four engine primitives Cable's precon cards (`next_evol` 40019-40025) needed. The engine's own
 * tests prove what each reads: `state-check-from-entering.test.ts`, `thwart-target-slot.test.ts` and
 * `put-into-play-upgrade.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  attachCard,
  chooseCards,
  chosen,
  constant,
  discard,
  response,
  rule,
  stateCheck,
  stateCheckFromEntering,
  takesConsequentialDamage,
  after,
  zone,
} from "./index.js";
import { defineAbilities } from "./validate.js";
import { attackTarget, canAttachTo, eachPlayer, exists, not, query, refMatches, self, thwartTarget } from "./values.js";

describe("stateCheckFromEntering", () => {
  it("compiles to a state check that also resolves on entering play; `stateCheck` stays edge-only", () => {
    const when = not(exists(query("ally", { name: "Fantomex" })));
    expect(stateCheckFromEntering(when, discard(self)).trigger).toEqual({
      kind: "stateCheck",
      when,
      fromEntering: true,
    });
    expect(stateCheck(when, discard(self)).trigger).toEqual({ kind: "stateCheck", when });
    expect(stateCheckFromEntering(when, discard(self)).effects).toEqual([discard(self)]);
  });
});

describe("thwartTarget / attackTarget", () => {
  it("name the slot a thwart or attack reports its target in, by default the consequential damage's", () => {
    expect(thwartTarget()).toEqual({ kind: "slot", slot: "thwart.target" });
    expect(thwartTarget("first")).toEqual({ kind: "slot", slot: "first.target" });
    expect(attackTarget()).toEqual({ kind: "slot", slot: "attack.target" });
    expect(attackTarget("hit")).toEqual({ kind: "slot", slot: "hit.target" });
  });

  it("'-1 consequential damage after thwarting a side scheme' validates as a constant rule", () => {
    const allies = query("ally", { controller: "you" });
    const registry = defineAbilities({
      "99122.constant": constant(
        rule(
          takesConsequentialDamage(allies, -1, {
            from: "thwart",
            if: refMatches(thwartTarget(), query("sideScheme"), { anywhere: true }),
          }),
        ),
      ),
    });
    const trigger = registry["99122.constant"]!.trigger;
    expect(trigger.kind === "constant" && trigger.rules).toEqual([
      {
        kind: "reduceDamageTaken",
        target: allies,
        amount: 1,
        consequential: {
          from: "thwart",
          if: {
            kind: "refMatches",
            ref: { kind: "slot", slot: "thwart.target" },
            query: { categories: ["sideScheme"] },
            anywhere: true,
          },
        },
      },
    ]);
  });
});

describe("canAttachTo", () => {
  it("compiles to the query field and validates in 'choose an upgrade … that can be attached to this ally'", () => {
    expect(canAttachTo(self)).toEqual({ canAttachTo: { kind: "self" } });
    const upgrades = query("upgrade", { maxPrintedCost: 1, ...canAttachTo(self) });
    expect(upgrades).toEqual({ categories: ["upgrade"], maxPrintedCost: 1, canAttachTo: { kind: "self" } });
    const registry = defineAbilities({
      "99125.response": response(
        after.entersPlay("self"),
        chooseCards("found", zone("discard", eachPlayer, { filter: upgrades }), { min: 0, max: 1 }),
        attachCard(chosen("found"), self),
      ),
    });
    expect(registry["99125.response"]!.effects).toHaveLength(2);
  });
});
